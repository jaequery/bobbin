// The AI judge and tagger. judgeSite looks at a captured site's two home-page
// folds and moves it to approved, rejected or failed (bad_capture); tagSite
// gives every page of an approved site a page pattern and every section crop a
// section type. Both write through lib/db.js and log token usage as events.
import Anthropic from "@anthropic-ai/sdk";
import { db, getSite, getSiteByDomain, recordEvent, upsertSite } from "../../lib/db.js";
import { imageBlock } from "./images.js";
import { JUDGE_SYSTEM, TAG_SYSTEM, judgeUserText } from "./prompt.js";
import { JUDGE_SCHEMA, SchemaError, TAG_SCHEMA, validateJudgement, validateTags } from "./schema.js";

export const judgeModel = () => process.env.BOBBIN_JUDGE_MODEL || "claude-sonnet-5-5";
export const minQuality = () => {
  const n = Number(process.env.BOBBIN_MIN_QUALITY);
  return Number.isFinite(n) && n > 0 ? n : 7;
};

const MAX_IMAGES = 12; // per tagging call, the page image included
// Models that take the server-side refusal fallback (`fallbacks: "default"`).
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"]);
// $ per million tokens: input, output. Cache writes cost 1.25x input, reads 0.1x.
const PRICES = {
  "claude-sonnet-5-5": [2, 10], "claude-sonnet-5": [2, 10], "claude-opus-5-5": [4, 20],
  "claude-opus-5": [5, 25], "claude-haiku-4-5": [1, 5], "claude-fable-5-1": [10, 50],
};

export class JudgeDisabled extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set; the judge is disabled");
    this.code = "judge_disabled";
  }
}

let client;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new JudgeDisabled();
  // The SDK retries 408/409/429/5xx and connection errors with backoff.
  return (client ??= new Anthropic({ maxRetries: 4 }));
}

/* ---------- Usage and cost ---------- */

export function costOf(usage, model = judgeModel()) {
  const [inp, out] = PRICES[model] ?? PRICES["claude-sonnet-5-5"];
  return ((usage.input_tokens ?? 0) * inp + (usage.cache_creation_input_tokens ?? 0) * inp * 1.25 +
    (usage.cache_read_input_tokens ?? 0) * inp * 0.1 + (usage.output_tokens ?? 0) * out) / 1e6;
}

function addUsage(total, u) {
  for (const k of ["input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"]) {
    total[k] = (total[k] ?? 0) + (u?.[k] ?? 0);
  }
  return total;
}

/* ---------- One structured call ---------- */

// Sends one request whose answer must be JSON matching `schema`, validates it
// with `validate`, and retries once on an invalid answer. Throws SchemaError
// after the second invalid answer; API errors propagate after the SDK's retries.
async function ask({ system, content, schema, validate, effort, usage }) {
  const model = judgeModel();
  const fallback = FALLBACK_MODELS.has(model);
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    // No temperature: current models reject non-default sampling parameters.
    const res = await getClient().beta.messages.create({
      model,
      max_tokens: 16000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
      output_config: { effort, format: { type: "json_schema", schema } },
      ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
    });
    addUsage(usage, res.usage);
    try {
      if (res.stop_reason === "refusal") throw new SchemaError(`refused (${res.stop_details?.category ?? "no category"})`);
      if (res.stop_reason === "max_tokens") throw new SchemaError("answer cut off at max_tokens");
      const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new SchemaError("answer is not JSON");
      }
      return validate(parsed);
    } catch (err) {
      if (!(err instanceof SchemaError)) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

/* ---------- Loading a site's images ---------- */

function resolveSite(siteOrId) {
  if (typeof siteOrId !== "string") return getSite(siteOrId.id) ?? siteOrId;
  const site = getSite(siteOrId) ?? getSiteByDomain(siteOrId);
  if (!site) throw new Error(`no site with id or domain ${siteOrId}`);
  return site;
}

function homeScreens(siteId) {
  const page = db.prepare("SELECT * FROM pages WHERE site_id = ? AND path = '/'").get(siteId);
  if (!page) return { page: null, screens: {} };
  const rows = db.prepare("SELECT * FROM screens WHERE page_id = ? AND lg_path IS NOT NULL").all(page.id);
  return { page, screens: Object.fromEntries(rows.map((r) => [r.platform, r])) };
}

/* ---------- Judging ---------- */

// Judges a captured site from its desktop and mobile home folds. With
// `dryRun` nothing is written. Returns { site, status, judgement, usage, cost }.
export async function judgeSite(siteOrId, { dryRun = false } = {}) {
  const site = resolveSite(siteOrId);
  const { page, screens } = homeScreens(site.id);
  const usage = {};

  if (!screens.desktop && !screens.mobile) {
    if (!dryRun) {
      upsertSite({ domain: site.domain, status: "failed", lastError: "no_capture" });
      recordEvent(site.id, "judge_failed", { code: "no_capture" });
    }
    return { site, status: "failed", error: "no_capture", usage, cost: 0 };
  }

  getClient(); // fail fast on a missing key, before touching the site's status
  // A site the pipeline already moved to judging goes back to captured on an API error.
  const previousStatus = site.status === "judging" ? "captured" : site.status;
  if (!dryRun) upsertSite({ domain: site.domain, status: "judging" });

  let judgement;
  try {
    const content = [];
    for (const platform of ["desktop", "mobile"]) {
      if (!screens[platform]) continue;
      content.push({ type: "text", text: `${platform === "desktop" ? "Desktop" : "Mobile"} fold:` }, await imageBlock(screens[platform].lg_path));
    }
    content.push({ type: "text", text: judgeUserText({ domain: site.domain, title: page.title, hasDesktop: !!screens.desktop, hasMobile: !!screens.mobile }) });
    judgement = await ask({ system: JUDGE_SYSTEM, content, schema: JUDGE_SCHEMA, validate: validateJudgement, effort: "medium", usage });
  } catch (err) {
    const cost = costOf(usage);
    if (dryRun) throw err;
    if (err instanceof SchemaError) {
      upsertSite({ domain: site.domain, status: "failed", lastError: `judge_schema: ${err.message}`.slice(0, 500), judgedAt: new Date().toISOString() });
      recordEvent(site.id, "judge_failed", { code: "schema", message: err.message, model: judgeModel(), usage, cost });
      return { site: getSite(site.id), status: "failed", error: err.message, usage, cost };
    }
    // API or local error: leave the site as it was so a later run retries it.
    upsertSite({ domain: site.domain, status: previousStatus });
    recordEvent(site.id, "judge_error", { message: String(err.message).slice(0, 500), status: err.status ?? null, model: judgeModel(), usage, cost });
    throw err;
  }

  const cost = costOf(usage);
  const status = !judgement.capture_ok ? "failed" : judgement.quality >= minQuality() ? "approved" : "rejected";
  if (dryRun) return { site, status, judgement, usage, cost };

  const now = new Date().toISOString();
  const notes = { scores: judgement.scores, reasons: judgement.verdict_reasons, model: judgeModel(), min_quality: minQuality() };
  if (!judgement.capture_ok) {
    upsertSite({
      domain: site.domain, status, lastError: "bad_capture", judgedAt: now,
      qualityNotes: JSON.stringify({ ...notes, capture_problem: judgement.capture_problem }),
    });
  } else {
    upsertSite({
      domain: site.domain, status, lastError: null, judgedAt: now,
      approvedAt: status === "approved" ? now : null,
      quality: judgement.quality, qualityNotes: JSON.stringify(notes),
      name: judgement.name, tagline: judgement.tagline, description: judgement.description,
      industry: judgement.industry, country: judgement.country, language: judgement.language,
    });
  }
  recordEvent(site.id, "judged", {
    status, quality: judgement.quality, capture_ok: judgement.capture_ok,
    ...(judgement.capture_ok ? {} : { capture_problem: judgement.capture_problem }),
    model: judgeModel(), usage, cost,
  });
  return { site: getSite(site.id), status, judgement, usage, cost };
}

/* ---------- Tagging ---------- */

// Tags every page of a site with a page pattern and every section crop (desktop
// and mobile) with a section type. Pages are tagged one call per batch of at
// most 12 images: the page's desktop fold plus up to 11 section thumbnails.
// Returns { pages: [{ path, pattern, sections }], usage, cost }.
export async function tagSite(siteOrId, { dryRun = false } = {}) {
  const site = resolveSite(siteOrId);
  getClient();
  const usage = {};
  const result = [];
  const pages = db.prepare("SELECT * FROM pages WHERE site_id = ? ORDER BY path").all(site.id);

  for (const page of pages) {
    const desktop = db.prepare("SELECT * FROM screens WHERE page_id = ? AND platform = 'desktop'").get(page.id);
    const pageImage = desktop?.lg_path ?? db.prepare("SELECT lg_path FROM screens WHERE page_id = ? AND lg_path IS NOT NULL").get(page.id)?.lg_path;
    if (!pageImage) continue;
    const sections = db.prepare(`
      SELECT se.*, sc.platform FROM sections se JOIN screens sc ON sc.id = se.screen_id
      WHERE sc.page_id = ? ORDER BY sc.platform, se.y
    `).all(page.id).filter((s) => s.sm_path || s.img_path);

    const pageBlock = await imageBlock(pageImage);
    const batches = [];
    for (let i = 0; i < Math.max(sections.length, 1); i += MAX_IMAGES - 1) batches.push(sections.slice(i, i + MAX_IMAGES - 1));

    const patterns = [];
    const types = new Map();
    for (const batch of batches) {
      // Short ids keep the model from mangling UUIDs.
      const ids = batch.map((_, i) => `s${i + 1}`);
      const content = [{ type: "text", text: `Page path: ${page.path}\nPage title: ${page.title || "(none)"}\n\nTop of the page at desktop width:` }, pageBlock];
      for (const [i, s] of batch.entries()) {
        content.push({ type: "text", text: `Section ${ids[i]} (${s.platform})` }, await imageBlock(s.sm_path || s.img_path));
      }
      content.push({ type: "text", text: batch.length ? "Tag this page and each section." : "Tag this page. There are no section crops, so return an empty sections list." });
      const tags = await ask({ system: TAG_SYSTEM, content, schema: TAG_SCHEMA, validate: (t) => validateTags(t, ids), effort: "low", usage });
      patterns.push(tags.pattern);
      for (const { id, type } of tags.sections) types.set(batch[ids.indexOf(id)].id, type);
    }

    // The first batch saw the page with its top sections; it decides the pattern.
    const pattern = patterns[0];
    if (!dryRun) {
      db.transaction(() => {
        db.prepare("UPDATE pages SET pattern = ? WHERE id = ?").run(pattern, page.id);
        const set = db.prepare("UPDATE sections SET type = ? WHERE id = ?");
        for (const [id, type] of types) set.run(type, id);
      })();
    }
    result.push({ path: page.path, pattern, sections: Object.fromEntries(types) });
  }

  const cost = costOf(usage);
  if (!dryRun) recordEvent(site.id, "tagged", { pages: result.length, sections: result.reduce((n, p) => n + Object.keys(p.sections).length, 0), model: judgeModel(), usage, cost });
  return { pages: result, usage, cost };
}
