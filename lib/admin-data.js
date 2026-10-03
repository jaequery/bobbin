// Queries and actions behind the local admin (app/api/admin/**). Server only.
// Unlike lib/queries.js these see every site, whatever its status or opt-out.
import { rm } from "node:fs/promises";
import path from "node:path";
import {
  dataDir, db, deleteSite, getOptout, getSite, listOptouts, recordEvent, setOptoutStatus, setSiteStatus, upsertSite,
} from "./db.js";
import { httpError } from "./admin.js";
import { activeJob, enqueue } from "./jobs.js";
import { reindexSite } from "./search.js";
import { INDUSTRIES, PAGE_PATTERNS, SECTION_TYPES } from "./taxonomy.js";

const shotsDir = path.join(dataDir, "shots");

// Admin tabs and the site statuses each lists.
export const TABS = {
  queue: ["captured", "failed", "queued", "capturing", "judging"],
  discovered: ["discovered"],
  approved: ["approved"],
  rejected: ["rejected", "optout"],
};

// A pipeline run or an admin job holds a site in one of these.
const BUSY = new Set(["queued", "capturing", "judging"]);

const shot = (rel, version) => (rel ? `/shots/${rel}${version ? `?v=${encodeURIComponent(version)}` : ""}` : null);

function notesOf(site) {
  try {
    return JSON.parse(site.quality_notes || "null") || {};
  } catch {
    return {};
  }
}

function siteRow(s) {
  const notes = notesOf(s);
  return {
    id: s.id, domain: s.domain, url: s.url || `https://${s.domain}/`, name: s.name, tagline: s.tagline,
    industry: s.industry, country: s.country, status: s.status, quality: s.quality,
    reasons: notes.reasons || [], scores: notes.scores || null, captureProblem: notes.capture_problem || null,
    source: s.source, lastError: s.last_error, attempts: s.attempts,
    discoveredAt: s.discovered_at, capturedAt: s.captured_at, judgedAt: s.judged_at, approvedAt: s.approved_at, updatedAt: s.updated_at,
  };
}

/* ---------- Reads ---------- */

export function tabCounts() {
  const by = Object.fromEntries(db.prepare("SELECT status, count(*) AS n FROM sites GROUP BY status").all().map((r) => [r.status, r.n]));
  const counts = Object.fromEntries(Object.entries(TABS).map(([tab, sts]) => [tab, sts.reduce((n, st) => n + (by[st] || 0), 0)]));
  counts.removals = db.prepare("SELECT count(*) FROM optouts WHERE coalesce(status, 'pending') = 'pending'").pluck().get();
  return counts;
}

// Sites in a tab, most recently updated first, each with its home thumbnails.
export function listTab(tab, { q = "", limit = 200 } = {}) {
  const statuses = TABS[tab];
  if (!statuses) throw httpError(400, `Unknown tab ${tab}`);
  const params = { limit: Math.min(Math.max(Number(limit) || 200, 1), 500) };
  statuses.forEach((st, i) => { params[`st${i}`] = st; });
  let where = `s.status IN (${statuses.map((_, i) => `@st${i}`).join(", ")})`;
  if (q) {
    params.q = `%${String(q).slice(0, 100).replace(/[\\%_]/g, (c) => "\\" + c)}%`;
    where += " AND (s.domain LIKE @q ESCAPE '\\' OR s.name LIKE @q ESCAPE '\\')";
  }
  const rows = db.prepare(`SELECT s.* FROM sites s WHERE ${where} ORDER BY coalesce(s.updated_at, s.discovered_at) DESC, s.id LIMIT @limit`).all(params);
  const thumbs = db.prepare(`
    SELECT sc.platform, sc.sm_path, sc.lg_path, sc.captured_at FROM screens sc JOIN pages p ON p.id = sc.page_id
    WHERE sc.site_id = ? AND p.path = '/'`);
  const optout = db.prepare("SELECT status FROM optouts WHERE domain = ?").pluck();
  return rows.map((s) => {
    const t = Object.fromEntries(thumbs.all(s.id).map((r) => [r.platform, { sm: shot(r.sm_path, r.captured_at), lg: shot(r.lg_path, r.captured_at) }]));
    return { ...siteRow(s), thumbs: { desktop: t.desktop || null, mobile: t.mobile || null }, optout: optout.get(s.domain) || null, job: activeJob(s.id) ? true : false };
  });
}

// One site with its pages, screens, sections and latest events.
export function siteDetail(id) {
  const s = getSite(id);
  if (!s) return null;
  const pages = db.prepare("SELECT * FROM pages WHERE site_id = ? ORDER BY (path = '/') DESC, path").all(id);
  const screens = db.prepare("SELECT * FROM screens WHERE site_id = ?").all(id);
  const sections = db.prepare(`
    SELECT x.*, sc.platform, sc.page_id FROM sections x JOIN screens sc ON sc.id = x.screen_id
    WHERE x.site_id = ? ORDER BY sc.platform, x.y`).all(id);
  const events = db.prepare("SELECT kind, detail, at FROM events WHERE site_id = ? ORDER BY id DESC LIMIT 15").all(id);
  return {
    ...siteRow(s),
    optout: getOptout(s.domain) || null,
    pages: pages.map((p) => ({
      id: p.id, path: p.path, url: p.url, title: p.title, pattern: p.pattern, capturedAt: p.captured_at,
      screens: screens.filter((sc) => sc.page_id === p.id).map((sc) => ({
        id: sc.id, platform: sc.platform, capturedAt: sc.captured_at,
        sm: shot(sc.sm_path, sc.captured_at), lg: shot(sc.lg_path, sc.captured_at), full: shot(sc.full_path, sc.captured_at),
      })),
      sections: sections.filter((x) => x.page_id === p.id).map((x) => ({ id: x.id, type: x.type, platform: x.platform, sm: shot(x.sm_path), img: shot(x.img_path) })),
    })),
    events: events.map((e) => ({ kind: e.kind, at: e.at, detail: e.detail })),
    job: activeJob(id) || null,
  };
}

/* ---------- Edits ---------- */

const text = (v, max) => (v == null || String(v).trim() === "" ? null : String(v).trim().slice(0, max));

// Applies an admin edit: { name, tagline, industry, country, status, pages: [{ id, pattern }],
// sections: [{ id, type }] }. Every enum is checked against lib/taxonomy.js.
export function updateSite(id, body) {
  const site = getSite(id);
  if (!site) return null;
  const fields = {};
  const errors = {};
  if ("name" in body) fields.name = text(body.name, 120);
  if ("tagline" in body) fields.tagline = text(body.tagline, 200);
  if ("industry" in body) {
    if (body.industry && !INDUSTRIES.includes(body.industry)) errors.industry = "Not an industry in the taxonomy";
    else fields.industry = body.industry || null;
  }
  if ("country" in body) {
    const c = text(body.country, 2);
    if (c && !/^[A-Za-z]{2}$/.test(String(body.country).trim())) errors.country = "Use an ISO 3166-1 alpha-2 code, like DE";
    else fields.country = c ? c.toUpperCase() : null;
  }
  let status = null;
  if ("status" in body) {
    if (!["approved", "rejected"].includes(body.status)) errors.status = "Status can be set to approved or rejected";
    else status = body.status;
  }
  const pages = Array.isArray(body.pages) ? body.pages : [];
  const sections = Array.isArray(body.sections) ? body.sections : [];
  if (pages.some((p) => !PAGE_PATTERNS.includes(p?.pattern))) errors.pages = "Unknown page pattern";
  if (sections.some((x) => !SECTION_TYPES.includes(x?.type))) errors.sections = "Unknown section type";
  if (Object.keys(errors).length) throw httpError(400, "Some fields are invalid", errors);
  if (status && BUSY.has(site.status)) throw httpError(409, "Site busy: a pipeline run or job holds it");

  db.transaction(() => {
    if (status && status !== site.status) {
      fields.status = status;
      if (status === "approved") fields.approvedAt = new Date().toISOString();
    }
    if (Object.keys(fields).length) upsertSite({ domain: site.domain, ...fields });
    const setPattern = db.prepare("UPDATE pages SET pattern = ? WHERE id = ? AND site_id = ?");
    for (const p of pages) setPattern.run(p.pattern, p.id, id);
    const setType = db.prepare("UPDATE sections SET type = ? WHERE id = ? AND site_id = ?");
    for (const x of sections) setType.run(x.type, x.id, id);
  })();
  reindexSite(id);
  recordEvent(id, "admin_edit", { fields: Object.keys(fields), pages: pages.length, sections: sections.length });
  return siteDetail(id);
}

// Deletes the site's rows and its data/shots/<id>/ directory.
export async function removeSite(id) {
  const site = getSite(id);
  if (!site) return null;
  if (BUSY.has(site.status) || activeJob(id)) throw httpError(409, "Site busy: a pipeline run or job holds it");
  deleteSite(id);
  reindexSite(id);
  await rm(path.join(shotsDir, id), { recursive: true, force: true });
  recordEvent(null, "admin_deleted", { siteId: id, domain: site.domain });
  return { deleted: id };
}

/* ---------- Jobs ---------- */

// The site, unless a pipeline run holds it or (when queueing) a job is already
// queued or running for it. Runs again when the job starts, since a pipeline
// run may have claimed the site while the job waited.
function claimable(id, { starting = false } = {}) {
  const site = getSite(id);
  if (!site) return null;
  if (BUSY.has(site.status) || (!starting && activeJob(id))) throw httpError(409, "Site busy: a pipeline run or job holds it");
  return site;
}

// Re-shoots the home page (and, for an approved site, its subpages), then puts
// the site back in the status it had: an approved site stays approved.
export function recapture(id) {
  const site = claimable(id);
  if (!site) return null;
  return enqueue({ kind: "recapture", siteId: id, domain: site.domain }, async () => {
    const before = claimable(id, { starting: true });
    if (!before) throw new Error("site was deleted");
    const { captureHome, captureSubpages, closeBrowser } = await import("../pipeline/capture.js");
    try {
      const home = await captureHome(id);
      let pages = home.pages;
      if (before.status === "approved") pages += (await captureSubpages(id, { links: home.links })).pages;
      if (["approved", "rejected"].includes(before.status)) setSiteStatus(id, before.status);
      recordEvent(id, "admin_recapture", { pages });
      return { pages };
    } finally {
      await closeBrowser();
    }
  });
}

// Judges the site again; when it is approved, captures its subpages if it has
// none yet and tags every page, like the pipeline does.
export function rejudge(id) {
  if (!process.env.ANTHROPIC_API_KEY) throw httpError(400, "ANTHROPIC_API_KEY is not set, so the judge is disabled");
  const site = claimable(id);
  if (!site) return null;
  return enqueue({ kind: "rejudge", siteId: id, domain: site.domain }, async () => {
    if (!claimable(id, { starting: true })) throw new Error("site was deleted");
    const { judgeSite, tagSite } = await import("../pipeline/judge/index.js");
    const r = await judgeSite(id);
    if (r.status !== "approved") return { status: r.status, quality: r.judgement?.quality ?? null };
    const { captureSubpages, closeBrowser } = await import("../pipeline/capture.js");
    setSiteStatus(id, "capturing");
    try {
      const pageCount = db.prepare("SELECT count(*) FROM pages WHERE site_id = ?").pluck().get(id);
      if (pageCount <= 1) await captureSubpages(id).catch((err) => recordEvent(id, "capture_failed", { message: String(err.message).slice(0, 500) }));
      await closeBrowser();
      const tags = await tagSite(id);
      return { status: r.status, quality: r.judgement.quality, tagged: tags.pages.length };
    } finally {
      setSiteStatus(id, "approved");
    }
  });
}

/* ---------- Seeds ---------- */

export async function addSeeds(input) {
  const { parseSeedText } = await import("../pipeline/discover/seeds.js");
  const { addCandidate } = await import("../pipeline/discover/index.js");
  const urls = parseSeedText(String(input || "")).slice(0, 100);
  if (!urls.length) throw httpError(400, "Add at least one URL", { urls: "One URL per line" });
  const results = [];
  for (const url of urls) {
    const result = await addCandidate({ url, sourceRef: "admin" }, "manual").catch((err) => err.message);
    results.push({ url, result });
  }
  return { results };
}

/* ---------- Removal requests ---------- */

export function removalRequests() {
  return listOptouts().map((o) => ({
    domain: o.domain, email: o.email, reason: o.reason, createdAt: o.created_at, status: o.status || "pending",
    siteId: o.site_id, siteStatus: o.site_status,
  }));
}

// 'approved' deletes the domain's site and files; 'dismissed' lets it back into
// the library and the pipeline.
export async function decideRemoval(domain, status) {
  if (!["approved", "dismissed"].includes(status)) throw httpError(400, "Status must be approved or dismissed", { status: "approved or dismissed" });
  const row = getOptout(domain);
  if (!row) return null;
  const site = db.prepare("SELECT * FROM sites WHERE domain = ?").get(row.domain);
  if (status === "approved" && site) {
    if (BUSY.has(site.status) || activeJob(site.id)) throw httpError(409, "Site busy: a pipeline run or job holds it");
    deleteSite(site.id);
    reindexSite(site.id);
    await rm(path.join(shotsDir, site.id), { recursive: true, force: true });
  }
  if (status === "dismissed" && site?.status === "optout") setSiteStatus(site.id, "discovered");
  setOptoutStatus(row.domain, status);
  recordEvent(site?.id ?? null, `removal_${status}`, { domain: row.domain, ...(status === "approved" && site ? { deletedSite: site.id } : {}) });
  return removalRequests().find((o) => o.domain === row.domain);
}
