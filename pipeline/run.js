// The orchestrator behind `npm run pipeline`: takes sites through
// discovered → captured (home) → judged → (if approved) subpages captured →
// tagged, a few sites at a time. Postgres is the queue: every site is claimed with
// one atomic UPDATE, so runs can overlap, crash and resume from DB state.
import { appendFileSync, mkdirSync, statfsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  claimSite, dataDir, deletePage, getSite, isOptedOut, listPages, moveSite, queueCounts, recordEvent,
  requeueFailed, requeueOldCaptures, resetStaleClaims, setSiteStatus, statusCounts,
} from "../lib/db.js";
import { reindexSite } from "../lib/search.js";
import { removeShots, removeSiteShots, shotsDir } from "../lib/shots.js";
import { captureHome, captureSubpages, closeBrowser } from "./capture.js";
import { discover } from "./discover/index.js";
import { judgeEnabled, judgeSite, tagSite } from "./judge/index.js";

const STALE_MS = 30 * 60 * 1000; // a transient status untouched this long belongs to a dead run
const RECYCLE_EVERY = 50; // sites per browser, to keep Chromium's memory in check
const MIN_FREE_BYTES = 2 * 1024 ** 3;
const MAX_ATTEMPTS = 3;

export const DEFAULTS = {
  discover: false, sources: ["galleries", "search"], discoverLimit: 200,
  limit: 25, concurrency: 3, maxJudge: 100, subpages: 8, discoverMs: null,
  recaptureOlderThan: null, retryFailed: false, pruneRejected: false, dryRun: false,
};

// "90d", "6h", "30m", "45s" -> milliseconds; null when unparseable.
export function parseDuration(text) {
  const m = /^(\d+(?:\.\d+)?)(s|m|h|d)$/.exec(String(text ?? "").trim());
  return m ? Number(m[1]) * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2]] : null;
}

const sleep = (ms, signal) => new Promise((resolve) => {
  if (signal?.aborted) return resolve();
  const t = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
});

const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

export function formatBytes(n) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (Math.abs(n) >= 1024 && i < units.length - 1) n /= 1024, i++;
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

async function dirSize(dir) {
  let total = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += await dirSize(p);
    else total += (await stat(p).catch(() => ({ size: 0 }))).size;
  }
  return total;
}

function freeBytes() {
  try {
    const s = statfsSync(dataDir);
    return s.bavail * s.bsize;
  } catch {
    return Infinity;
  }
}

/* ---------- Logging: stdout plus a JSONL file per day ---------- */

export const logsDir = path.join(dataDir, "logs");

function makeLogger(runId) {
  mkdirSync(logsDir, { recursive: true });
  return (line, entry = {}) => {
    const at = new Date().toISOString();
    console.log(line);
    try {
      appendFileSync(path.join(logsDir, `pipeline-${at.slice(0, 10)}.jsonl`), JSON.stringify({ at, run: runId, ...entry, msg: line }) + "\n");
    } catch {
      // A full disk must not crash the run; stdout still has the line.
    }
  };
}

/* ---------- One run ---------- */

// Runs the pipeline once. `signal` aborts gracefully: no new claims, in-flight
// sites finish. Returns the run's totals.
export async function runPipeline(options = {}, { signal } = {}) {
  const opts = { ...DEFAULTS, ...options };
  const runId = randomUUID().slice(0, 8);
  const log = makeLogger(runId);
  const started = Date.now();
  let judgeOn = judgeEnabled();
  const totals = {
    discovered: 0, claimed: 0, captured: 0, approved: 0, rejected: 0, failed: 0, skipped: 0,
    deferred: 0, tagged: 0, aiCalls: 0, cost: 0, diskAdded: 0, stopped: null,
  };

  if (opts.dryRun) {
    const q = await queueCounts();
    log(`dry run: would advance up to ${opts.limit} sites, ${opts.concurrency} at a time, at most ${opts.maxJudge} AI calls`);
    log(`waiting: ${q.capture} to capture, ${q.judge} to judge, ${q.finish} approved to finish`);
    log(`by status: ${Object.entries(await statusCounts()).map(([s, n]) => `${s} ${n}`).join(", ") || "no sites"}`);
    if (opts.discover) log(`would discover from ${opts.sources.join(", ")} first`);
    if (!judgeOn) log("no AI credentials: sites would only be captured");
    return totals;
  }

  await recordEvent(null, "pipeline_started", { run: runId, pid: process.pid, options: opts });
  log(`run ${runId}: limit ${opts.limit}, concurrency ${opts.concurrency}, max AI calls ${opts.maxJudge}`, { event: "start", options: opts });
  if (!judgeOn) log("warning: no AI credentials (ANTHROPIC_API_KEY, AI_GATEWAY_API_KEY or a Vercel OIDC token), so sites are captured but not judged; they stay 'captured' for a later run");
  else if (opts.maxJudge < 2) log("warning: judging a site needs room for 2 AI calls (judge + tag); --max-judge below 2 judges nothing");

  // Resume: sites a crashed run left in a transient status become claimable again.
  for (const r of await resetStaleClaims(new Date(Date.now() - STALE_MS).toISOString())) {
    log(`resume ${r.domain} -> ${r.status}`, { event: "reset", domain: r.domain, status: r.status });
  }
  if (opts.retryFailed) {
    const rows = await requeueFailed(MAX_ATTEMPTS);
    log(`re-queued ${rows.length} failed sites`, { event: "retry_failed", count: rows.length });
  }
  if (opts.recaptureOlderThan) {
    const before = new Date(Date.now() - opts.recaptureOlderThan).toISOString();
    const rows = await requeueOldCaptures(before, opts.limit);
    log(`re-queued ${rows.length} approved sites captured before ${before.slice(0, 10)}`, { event: "recapture", count: rows.length });
  }

  if (opts.discover && !signal?.aborted) {
    log(`discovering from ${opts.sources.join(", ")}…`);
    try {
      const until = opts.discoverMs ? Date.now() + opts.discoverMs : undefined;
      const d = await discover({ sources: opts.sources, limit: opts.discoverLimit, until, log: (line) => log(`  ${line.trim()}`) });
      totals.discovered = d.inserted;
      log(`discovery: found ${d.found}, inserted ${d.inserted}, skipped ${d.skipped}`, { event: "discovered", ...d });
    } catch (err) {
      log(`discovery failed, continuing with the existing queue: ${err.message}`, { event: "discover_failed", error: err.message });
    }
  }

  const diskBefore = await dirSize(shotsDir);

  // AI budget: judging reserves 2 calls (judge + tag) and hands one back when the
  // site is not approved; finishing an approved site reserves 1.
  let budget = opts.maxJudge;
  const take = (n) => (judgeOn && budget >= n ? ((budget -= n), true) : false);
  const give = (n) => { budget += n; };

  const seen = [];
  let index = 0;
  let active = 0;
  let sinceRecycle = 0;
  let recycling = null;
  let warnedBudget = false;

  // Playwright errors carry a multi-line call log; keep the first line.
  const say = (i, domain, what, ms, entry = {}) =>
    log(`[${i}/${opts.limit}] ${domain} ${what.split("\n")[0]}${ms != null ? ` ${secs(ms)}` : ""}`, { domain, ...entry });

  function stopReason() {
    if (signal?.aborted) return "interrupted";
    if (index >= opts.limit) return "limit";
    // Shots in Blob use no local disk (and a function's /tmp is small).
    if (!process.env.BLOB_READ_WRITE_TOKEN && freeBytes() < MIN_FREE_BYTES) return "low_disk";
    return null;
  }

  // Next site to work on: unfinished approved sites first, then captured sites
  // waiting for the judge, then discovered sites.
  async function nextJob() {
    if (take(1)) {
      const site = await claimSite("finish", { exclude: seen });
      if (site) return { kind: "finish", site };
      give(1);
    }
    if (take(2)) {
      const site = await claimSite("judge", { exclude: seen });
      if (site) return { kind: "judge", site };
      give(2);
    }
    for (;;) {
      const site = await claimSite("capture", { exclude: seen });
      if (!site) return null;
      if (!(await isOptedOut(site.domain))) return { kind: "capture", site };
      // Opted out after it was discovered: never load it.
      seen.push(site.id);
      await setSiteStatus(site.id, "optout");
      await recordEvent(site.id, "capture_skipped", { reason: "optout", run: runId });
      log(`skip ${site.domain}: opted out`, { domain: site.domain, event: "optout" });
      totals.skipped++;
    }
  }

  async function maybeRecycle() {
    if (sinceRecycle < RECYCLE_EVERY) return;
    recycling ??= (async () => {
      while (active > 0) await sleep(250);
      await closeBrowser();
      sinceRecycle = 0;
      log("recycled the browser");
    })().finally(() => { recycling = null; });
    await recycling;
  }

  async function judgeAndFinish(site, links, i) {
    const t = Date.now();
    let r;
    try {
      r = await judgeSite(site.id);
    } catch (err) {
      // judgeSite put the site back to captured; the next run retries it.
      totals.aiCalls++;
      give(1);
      say(i, site.domain, `judge error, left captured: ${err.message}`, Date.now() - t, { event: "judge_error" });
      // Bad credentials, no credits or a model the account may not use: every
      // later call would fail the same way, so capture only for the rest of the
      // run instead of spending its limit on judge attempts.
      if (judgeOn && [401, 402, 403].includes(err.status)) {
        judgeOn = false;
        log(`warning: the judge was refused (${err.status}); capturing only for the rest of this run`, { event: "judge_refused", status: err.status });
      }
      return;
    }
    if (r.error === "no_capture") {
      give(2);
      totals.failed++;
      say(i, site.domain, "failed: no home capture to judge", null, { event: "failed" });
      return;
    }
    totals.aiCalls++;
    totals.cost += r.cost;
    totals[r.status]++;
    const quality = r.judgement?.capture_ok ? ` (quality ${r.judgement.quality})` : r.error ? ` (${r.error})` : " (bad capture)";
    say(i, site.domain, `${r.status}${quality}`, Date.now() - t, { event: r.status, quality: r.judgement?.quality ?? null, cost: r.cost });

    if (r.status !== "approved") {
      give(1);
      if (r.status === "rejected" && opts.pruneRejected) await prune(site.id, i, site.domain);
      return;
    }
    // Hidden from the library until its subpages and tags are in.
    if (!(await moveSite(site.id, "approved", "capturing"))) return;
    await finish(site, links, i);
  }

  // Captures an approved site's subpages and tags every page, then puts it back
  // to approved. Expects the site in 'capturing' with one AI call reserved.
  async function finish(site, links, i) {
    try {
      let t = Date.now();
      try {
        const sub = await captureSubpages(site.id, { links, max: opts.subpages });
        say(i, site.domain, `subpages captured (${sub.pages} pages${sub.skipped.length ? `, ${sub.skipped.length} skipped` : ""})`, Date.now() - t, { event: "subpages", pages: sub.pages });
      } catch (err) {
        say(i, site.domain, `subpages failed, tagging the home page only: ${err.message}`, Date.now() - t, { event: "subpages_failed" });
      }
      t = Date.now();
      totals.aiCalls++;
      try {
        const tags = await tagSite(site.id);
        totals.cost += tags.cost;
        totals.tagged++;
        say(i, site.domain, `tagged (${tags.pages.length} pages)`, Date.now() - t, { event: "tagged", pages: tags.pages.length, cost: tags.cost });
      } catch (err) {
        await recordEvent(site.id, "tag_error", { message: String(err.message).slice(0, 500), run: runId });
        say(i, site.domain, `tagging failed, will retry next run: ${err.message}`, Date.now() - t, { event: "tag_error" });
      }
    } finally {
      await moveSite(site.id, "capturing", "approved");
    }
  }

  async function prune(siteId, i, domain) {
    for (const page of await listPages(siteId)) await removeShots(await deletePage(page.id));
    await removeSiteShots(siteId);
    await reindexSite(siteId);
    say(i, domain, "pruned rejected screenshots", null, { event: "pruned" });
  }

  async function processJob({ kind, site }, i) {
    if (kind === "finish") return finish(site, undefined, i);
    if (kind === "judge") return judgeAndFinish(site, undefined, i);

    const t = Date.now();
    let home;
    try {
      home = await captureHome(site.id);
    } catch (err) {
      const now = await getSite(site.id);
      if (err.code === "optout" || err.code === "robots_disallowed") {
        totals.skipped++;
        say(i, site.domain, `skipped: ${err.code}`, Date.now() - t, { event: "skipped", code: err.code });
      } else {
        if (now?.status === "failed") totals.failed++;
        const what = now?.status === "failed" ? "failed" : `capture error (attempt ${now?.attempts ?? "?"}, will retry)`;
        say(i, site.domain, `${what}: ${err.code || err.message}`, Date.now() - t, { event: "capture_failed", code: err.code ?? null });
      }
      return;
    }
    totals.captured++;
    say(i, site.domain, `captured (${home.sections} sections)`, Date.now() - t, { event: "captured" });

    if (!judgeOn) return;
    if (!take(2)) {
      totals.deferred++;
      if (!warnedBudget) log(`AI call budget (${opts.maxJudge}) used up: further sites stay 'captured' for the next run`);
      warnedBudget = true;
      return;
    }
    if (!(await moveSite(site.id, "captured", "judging"))) return give(2);
    await judgeAndFinish(site, home.links, i);
  }

  // Puts a site back where it can be claimed after an unexpected error.
  async function release(kind, siteId) {
    const s = await getSite(siteId);
    if (!s) return;
    if (s.status === "judging") await moveSite(siteId, "judging", "captured");
    else if (s.status === "capturing") await moveSite(siteId, "capturing", kind === "capture" ? "discovered" : "approved");
    else if (s.status === "queued") await moveSite(siteId, "queued", "discovered");
  }

  async function worker() {
    for (;;) {
      if (stopReason()) return;
      await maybeRecycle();
      if (stopReason()) return;
      const job = await nextJob();
      if (!job) return;
      const i = ++index;
      seen.push(job.site.id);
      totals.claimed++;
      active++;
      sinceRecycle++;
      await recordEvent(job.site.id, "pipeline_claimed", { run: runId, pid: process.pid, kind: job.kind });
      try {
        await processJob(job, i);
      } catch (err) {
        await release(job.kind, job.site.id).catch(() => {});
        await recordEvent(job.site.id, "pipeline_error", { run: runId, kind: job.kind, message: String(err.message).slice(0, 500) });
        say(i, job.site.domain, `error: ${err.message}`, null, { event: "error" });
      } finally {
        active--;
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.max(1, opts.concurrency) }, worker));
  } finally {
    await closeBrowser();
  }

  totals.stopped = stopReason() ?? "queue_empty";
  if (totals.stopped === "low_disk") log(`warning: less than ${formatBytes(MIN_FREE_BYTES)} free under ${dataDir}; stopped claiming sites`);
  totals.diskAdded = (await dirSize(shotsDir)) - diskBefore;
  totals.elapsed = Date.now() - started;
  await recordEvent(null, "pipeline_finished", { run: runId, pid: process.pid, ...totals });
  log(summaryTable(totals), { event: "summary", totals });
  return totals;
}

const STOP_LABELS = { interrupted: "interrupted", limit: "reached --limit", low_disk: "low disk space", queue_empty: "queue empty" };

export function summaryTable(t) {
  const rows = [
    ["discovered", t.discovered], ["claimed", t.claimed], ["captured", t.captured],
    ["approved", t.approved], ["rejected", t.rejected], ["failed", t.failed], ["skipped", t.skipped],
    ["left captured (budget)", t.deferred], ["tagged", t.tagged], ["AI calls", t.aiCalls],
    ["est. cost", `$${t.cost.toFixed(4)}`], ["disk added", formatBytes(t.diskAdded)],
    ["time", secs(t.elapsed ?? 0)], ["stopped", STOP_LABELS[t.stopped] ?? t.stopped],
  ];
  const w = Math.max(...rows.map(([k]) => k.length));
  return ["", "summary", ...rows.map(([k, v]) => `  ${k.padEnd(w)}  ${v}`)].join("\n");
}
