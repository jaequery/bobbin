// Read-only queries behind the public browse API (app/api/**). Server only, like
// lib/db.js, whose connection it uses.
//
// Only public sites are ever returned: status 'approved' (plus 'captured' when
// JETHRO_SHOW_UNJUDGED=1, for local development) and a domain with no pending or
// approved row in `optouts`. Lists use keyset pagination: pass the returned `next` back as
// `cursor`; a cursor that does not decode starts again from the first page.
import { all, get, OPTOUT_BLOCKS } from "./db.js";
import { COLOR_BUCKETS, INDUSTRIES, PAGE_PATTERNS, PLATFORMS, SECTION_TYPES, THEMES } from "./taxonomy.js";
import { countryName, isCountryCode, regionOf, REGIONS } from "./regions.js";
import { ensureIndex, MATCH, RANK, searchQuery } from "./search.js";

// CSS widths the capture engine shoots at (pipeline/browser.js VIEWPORTS). A
// section crop's aspect is this width over its stored css height.
const VIEWPORT_WIDTH = { desktop: 1440, mobile: 390 };

// Image URL under app/shots. Screen files keep their name across re-captures, so
// they carry the capture time to get past the year-long immutable cache.
const shot = (rel, version) => (rel ? `/shots/${rel}${version ? `?v=${encodeURIComponent(version)}` : ""}` : null);

function publicStatuses() {
  return process.env.JETHRO_SHOW_UNJUDGED === "1" ? ["approved", "captured"] : ["approved"];
}

// Condition on the `s` (sites) alias.
function publicSites(params) {
  const statuses = publicStatuses();
  statuses.forEach((st, i) => { params[`st${i}`] = st; });
  return `s.status IN (${statuses.map((_, i) => `@st${i}`).join(", ")})
    AND NOT EXISTS (SELECT 1 FROM optouts o WHERE o.domain = s.domain AND ${OPTOUT_BLOCKS})`;
}

const oneOf = (list, v) => (v && list.includes(v) ? v : "");

// Drops filter values outside the taxonomy instead of returning an impossible empty list.
export function cleanFilters(input = {}) {
  return {
    q: String(input.q || "").trim().slice(0, 100),
    platform: oneOf(PLATFORMS.map((p) => p.id), input.platform),
    pattern: oneOf(PAGE_PATTERNS, input.pattern),
    section: oneOf(SECTION_TYPES, input.section),
    industry: oneOf(INDUSTRIES, input.industry),
    color: oneOf(COLOR_BUCKETS.map((c) => c.id), input.color),
    theme: oneOf(THEMES.map((t) => t.id), input.theme),
    country: isCountryCode(input.country) ? input.country : "",
  };
}

const likeArg = (q) => `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;

// Sets @fts in `params` and returns true when `q` uses the full-text index
// rather than ILIKE (see searchQuery).
function useFts(f, params) {
  const fts = f.q && searchQuery(f.q);
  if (!fts) return false;
  params.fts = fts;
  return true;
}

// A `hits` table of the pages matching @fts with their score, higher is better.
const HITS = `WITH hits AS MATERIALIZED (SELECT site_id, page_id, ${RANK} AS score FROM search_idx WHERE ${MATCH}) `;

// Conditions on a screen row `sc`, its page `p` and its site `s`. With
// `ranked`, the caller joins HITS itself and the `q` condition is left out.
function screenWhere(f, params, { ranked = false } = {}) {
  const where = [publicSites(params)];
  if (useFts(f, params)) {
    if (!ranked) where.push(`sc.page_id IN (SELECT page_id FROM search_idx WHERE ${MATCH})`);
  } else if (f.q) {
    params.q = likeArg(f.q);
    where.push(`(s.name ILIKE @q ESCAPE '\\' OR s.domain ILIKE @q ESCAPE '\\' OR s.tagline ILIKE @q ESCAPE '\\'
      OR s.industry ILIKE @q ESCAPE '\\' OR p.title ILIKE @q ESCAPE '\\' OR p.pattern ILIKE @q ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM sections qx WHERE qx.screen_id = sc.id AND qx.type ILIKE @q ESCAPE '\\'))`);
  }
  if (f.platform) { params.platform = f.platform; where.push("sc.platform = @platform"); }
  if (f.pattern) { params.pattern = f.pattern; where.push("p.pattern = @pattern"); }
  if (f.industry) { params.industry = f.industry; where.push("s.industry = @industry"); }
  if (f.section) { params.section = f.section; where.push("EXISTS (SELECT 1 FROM sections fx WHERE fx.screen_id = sc.id AND fx.type = @section)"); }
  if (f.color) { params.color = f.color; where.push("sc.hue_bucket = @color"); }
  if (f.theme) { params.theme = f.theme; where.push("sc.theme = @theme"); }
  if (f.country) { params.country = f.country; where.push("s.country = @country"); }
  return where;
}

/* ---------- Cursors ---------- */

const encodeCursor = (key, id) => Buffer.from(JSON.stringify([key, id])).toString("base64url");

// `keyType` is "number" for a score key, else "string": a cursor from the other
// kind of list (say, from before `q` changed) starts again from the first page.
function decodeCursor(cursor, keyType) {
  if (!cursor) return null;
  try {
    const v = JSON.parse(Buffer.from(String(cursor), "base64url").toString());
    return Array.isArray(v) && v.length === 2 && typeof v[0] === keyType && typeof v[1] === "string" ? v : null;
  } catch {
    return null;
  }
}

function clampLimit(limit, fallback) {
  const n = Number.parseInt(limit, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : fallback;
}

// Runs one keyset page of `select`, newest (or best-scoring) first. Rows must
// carry `sort_key` (the value of `keyExpr`) and `id` (the value of `idExpr`).
async function page({ select, count, where, params, cursor, limit, keyExpr, idExpr, scored = false }) {
  const total = (await get(`${count} WHERE ${where.join(" AND ")}`, params)).n;
  const c = decodeCursor(cursor, scored ? "number" : "string");
  const w = [...where];
  const p = { ...params, limit: limit + 1 };
  if (c) {
    w.push(`(${keyExpr} < @ck OR (${keyExpr} = @ck AND ${idExpr} < @cid))`);
    p.ck = c[0]; p.cid = c[1];
  }
  const rows = await all(`${select} WHERE ${w.join(" AND ")} ORDER BY ${keyExpr} DESC, ${idExpr} DESC LIMIT @limit`, p);
  const more = rows.length > limit;
  const items = more ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, total, next: more ? encodeCursor(last.sort_key, last.id) : null };
}

/* ---------- Shapes sent to the browser ---------- */

function siteOut(s) {
  return {
    id: s.id, name: s.name || s.domain, domain: s.domain, url: s.url || `https://${s.domain}/`,
    tagline: s.tagline, description: s.description, industry: s.industry, country: s.country,
    toneA: s.tone_a, toneB: s.tone_b, capturedAt: s.captured_at,
  };
}

function screenOut(r) {
  return {
    id: r.id, siteId: r.site_id, siteName: r.site_name || r.domain, domain: r.domain,
    platform: r.platform, pattern: r.pattern, path: r.path, url: r.page_url, title: r.page_title,
    width: r.width, height: r.height,
    full: shot(r.full_path, r.captured_at), lg: shot(r.lg_path, r.captured_at), sm: shot(r.sm_path, r.captured_at),
    toneA: r.tone_a, toneB: r.tone_b, color: r.hue_bucket, theme: r.theme,
  };
}

function sectionOut(r) {
  return {
    id: r.id, siteId: r.site_id, siteName: r.site_name || r.domain, domain: r.domain,
    type: r.type, platform: r.platform, pattern: r.pattern, path: r.path, url: r.page_url,
    width: VIEWPORT_WIDTH[r.platform] || 1440, height: r.height || 1,
    img: shot(r.img_path), sm: shot(r.sm_path),
  };
}

const SCREEN_COLS = `sc.*, p.pattern, p.path, p.url AS page_url, p.title AS page_title,
  s.domain, s.name AS site_name, s.tone_a, s.tone_b`;

/* ---------- Public queries ---------- */

export async function isPublicSite(id) {
  const params = { id };
  return !!(await get(`SELECT 1 FROM sites s WHERE s.id = @id AND ${publicSites(params)}`, params));
}

const SITE_KEY = "COALESCE(s.approved_at, s.captured_at, s.discovered_at, '')";

// Sites with at least one screen matching every filter, newest approval first,
// or best match first for a full-text `q`. Each carries a desktop and a mobile
// cover: the home page, or the first page with the chosen pattern.
export async function querySites(input = {}, { cursor, limit } = {}) {
  const f = cleanFilters(input);
  if (f.q) await ensureIndex();
  const params = {};
  const inner = screenWhere(f, params);
  const where = [publicSites(params), `EXISTS (SELECT 1 FROM screens sc LEFT JOIN pages p ON p.id = sc.page_id WHERE sc.site_id = s.id AND ${inner.join(" AND ")})`];
  const hits = !!params.fts;
  const res = await page({
    select: hits
      ? `${HITS}SELECT s.*, h.score AS sort_key FROM sites s JOIN (SELECT site_id, max(score) AS score FROM hits GROUP BY site_id) h ON h.site_id = s.id`
      : `SELECT s.*, ${SITE_KEY} AS sort_key FROM sites s`,
    count: "SELECT COUNT(*) AS n FROM sites s",
    where, params, cursor, limit: clampLimit(limit, 24), keyExpr: hits ? "h.score" : SITE_KEY, idExpr: "s.id", scored: hits,
  });
  const cover = `
    SELECT ${SCREEN_COLS} FROM screens sc JOIN sites s ON s.id = sc.site_id LEFT JOIN pages p ON p.id = sc.page_id
    WHERE sc.site_id = @siteId AND sc.platform = @platform
    ORDER BY (p.pattern = @pattern) DESC NULLS LAST, (p.path = '/') DESC NULLS LAST, p.path LIMIT 1`;
  res.items = await Promise.all(res.items.map(async (s) => {
    const pick = async (platform) => {
      if (f.platform && f.platform !== platform) return null;
      const r = await get(cover, { siteId: s.id, platform, pattern: f.pattern || "Home" });
      return r ? screenOut(r) : null;
    };
    const [desktop, mobile] = await Promise.all([pick("desktop"), pick("mobile")]);
    return { ...siteOut(s), cover: { desktop, mobile } };
  }));
  return res;
}

// Newest first, or best match first for a full-text `q`. The ranked join
// replaces screenWhere's own `q` condition.
export async function queryScreens(input = {}, { cursor, limit } = {}) {
  const f = cleanFilters(input);
  if (f.q) await ensureIndex();
  const params = {};
  const where = screenWhere(f, params, { ranked: true });
  const hits = !!params.fts;
  const from = `FROM screens sc JOIN sites s ON s.id = sc.site_id LEFT JOIN pages p ON p.id = sc.page_id ${hits ? "JOIN hits h ON h.page_id = sc.page_id" : ""}`;
  const res = await page({
    select: `${hits ? HITS : ""}SELECT ${SCREEN_COLS}, ${hits ? "h.score" : "sc.captured_at"} AS sort_key ${from}`,
    count: `${hits ? HITS : ""}SELECT COUNT(*) AS n ${from}`,
    where, params, cursor, limit: clampLimit(limit, 36),
    keyExpr: hits ? "h.score" : "COALESCE(sc.captured_at, '')", idExpr: "sc.id", scored: hits,
  });
  res.items = res.items.map(screenOut);
  return res;
}

export async function querySections(input = {}, { cursor, limit } = {}) {
  const f = cleanFilters(input);
  if (f.q) await ensureIndex();
  const params = {};
  const where = screenWhere({ ...f, section: "" }, params, { ranked: true });
  const hits = !!params.fts;
  if (f.section) { params.type = f.section; where.push("x.type = @type"); }
  const from = `FROM sections x JOIN screens sc ON sc.id = x.screen_id JOIN sites s ON s.id = x.site_id
    LEFT JOIN pages p ON p.id = sc.page_id ${hits ? "JOIN hits h ON h.page_id = sc.page_id" : ""}`;
  const res = await page({
    select: `${hits ? HITS : ""}SELECT x.*, sc.platform, ${hits ? "h.score" : "sc.captured_at"} AS sort_key, p.pattern, p.path, p.url AS page_url, s.domain, s.name AS site_name ${from}`,
    count: `${hits ? HITS : ""}SELECT COUNT(*) AS n ${from}`,
    where, params, cursor, limit: clampLimit(limit, 36),
    keyExpr: hits ? "h.score" : "COALESCE(sc.captured_at, '')", idExpr: "x.id", scored: hits,
  });
  res.items = res.items.map(sectionOut);
  return res;
}

// One public site with all its pages, screens and sections, or null.
export async function querySite(id) {
  if (!(await isPublicSite(id))) return null;
  const [s, screens, sections, pages] = await Promise.all([
    get("SELECT * FROM sites WHERE id = @id", { id }),
    all(`
      SELECT ${SCREEN_COLS} FROM screens sc JOIN sites s ON s.id = sc.site_id LEFT JOIN pages p ON p.id = sc.page_id
      WHERE sc.site_id = @id ORDER BY (p.path = '/') DESC NULLS LAST, p.path, sc.platform`, { id }),
    all(`
      SELECT x.*, sc.platform, p.pattern, p.path, p.url AS page_url, s.domain, s.name AS site_name
      FROM sections x JOIN screens sc ON sc.id = x.screen_id JOIN sites s ON s.id = x.site_id LEFT JOIN pages p ON p.id = sc.page_id
      WHERE x.site_id = @id ORDER BY (p.path = '/') DESC NULLS LAST, p.path, x.y`, { id }),
    all("SELECT id, path, url, pattern, title, captured_at FROM pages WHERE site_id = @id ORDER BY (path = '/') DESC NULLS LAST, path", { id }),
  ]);
  return {
    ...siteOut(s),
    pages: pages.map((p) => ({ id: p.id, path: p.path, url: p.url, pattern: p.pattern, title: p.title, capturedAt: p.captured_at })),
    screens: screens.map(screenOut),
    sections: sections.map(sectionOut),
  };
}

// The taxonomy with how many public items carry each value, for the filter menus.
export async function libraryMeta() {
  const params = {};
  const pub = publicSites(params);
  const tally = async (sql) => Object.fromEntries((await all(sql, params)).map((r) => [r.k, r.n]));
  const screensFrom = `FROM screens sc JOIN sites s ON s.id = sc.site_id LEFT JOIN pages p ON p.id = sc.page_id WHERE ${pub}`;
  const [byPlatform, byPattern, byType, byIndustry, byColor, byTheme, byCountry] = await Promise.all([
    tally(`SELECT sc.platform AS k, COUNT(*) AS n ${screensFrom} GROUP BY 1`),
    tally(`SELECT p.pattern AS k, COUNT(*) AS n ${screensFrom} GROUP BY 1`),
    tally(`SELECT x.type AS k, COUNT(*) AS n FROM sections x JOIN sites s ON s.id = x.site_id WHERE ${pub} GROUP BY 1`),
    tally(`SELECT s.industry AS k, COUNT(*) AS n FROM sites s WHERE ${pub} AND EXISTS (SELECT 1 FROM screens sc WHERE sc.site_id = s.id) GROUP BY 1`),
    tally(`SELECT sc.hue_bucket AS k, COUNT(*) AS n ${screensFrom} GROUP BY 1`),
    tally(`SELECT sc.theme AS k, COUNT(*) AS n ${screensFrom} GROUP BY 1`),
    tally(`SELECT s.country AS k, COUNT(*) AS n FROM sites s WHERE ${pub} AND EXISTS (SELECT 1 FROM screens sc WHERE sc.site_id = s.id) GROUP BY 1`),
  ]);
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  return {
    totals: { sites: sum(byIndustry), screens: sum(byPlatform), sections: sum(byType) },
    platforms: PLATFORMS.map((p) => ({ value: p.id, label: p.label, count: byPlatform[p.id] || 0 })),
    patterns: PAGE_PATTERNS.map((v) => ({ value: v, label: v, count: byPattern[v] || 0 })),
    sections: SECTION_TYPES.map((v) => ({ value: v, label: v, count: byType[v] || 0 })),
    industries: INDUSTRIES.map((v) => ({ value: v, label: v, count: byIndustry[v] || 0 })),
    colors: COLOR_BUCKETS.map((c) => ({ value: c.id, label: c.label, swatch: c.swatch, count: byColor[c.id] || 0 })),
    themes: THEMES.map((t) => ({ value: t.id, label: t.label, count: byTheme[t.id] || 0 })),
    // Only countries with public sites, by region and then name.
    countries: Object.keys(byCountry).filter(isCountryCode)
      .map((code) => ({ value: code, label: countryName(code), region: regionOf(code), count: byCountry[code] }))
      .sort((a, b) => REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region) || a.label.localeCompare(b.label)),
  };
}

// Up to `limit` suggestions for a partly typed query: page patterns, section
// types and industries whose words start with every typed word (only values
// public items carry), then the best-matching sites (name and domain weigh most). Each is
// { kind: "pattern" | "section" | "industry" | "site", value, label, sub }.
export async function querySuggest(q, limit = 8) {
  const text = String(q || "").trim().slice(0, 100);
  if (!text) return { items: [] };
  const params = {};
  const pub = publicSites(params);
  const present = async (sql) => new Set((await all(sql, params)).map((r) => Object.values(r)[0]));
  const words = text.toLowerCase().split(/\s+/);
  const fits = (label) => {
    const parts = label.toLowerCase().split(/[\s&/-]+/);
    return words.every((w) => parts.some((p) => p.startsWith(w))) || label.toLowerCase().startsWith(text.toLowerCase());
  };
  const terms = (await Promise.all([
    ["pattern", PAGE_PATTERNS, `SELECT DISTINCT p.pattern FROM pages p JOIN sites s ON s.id = p.site_id WHERE ${pub}`, "Page pattern"],
    ["section", SECTION_TYPES, `SELECT DISTINCT x.type FROM sections x JOIN sites s ON s.id = x.site_id WHERE ${pub}`, "Section"],
    ["industry", INDUSTRIES, `SELECT DISTINCT s.industry FROM sites s WHERE ${pub}`, "Industry"],
  ].map(async ([kind, list, sql, sub]) => {
    const matches = list.filter(fits);
    if (!matches.length) return [];
    const has = await present(sql);
    return matches.filter((v) => has.has(v)).map((v) => ({ kind, value: v, label: v, sub }));
  }))).flat().slice(0, Math.ceil(limit / 2));

  const fts = searchQuery(text);
  let rows;
  if (fts) {
    await ensureIndex();
    params.fts = fts;
    rows = await all(`
      ${HITS}SELECT s.id, s.name, s.domain, s.industry, max(h.score) AS score
      FROM hits h JOIN sites s ON s.id = h.site_id
      WHERE ${pub}
      GROUP BY s.id ORDER BY score DESC LIMIT @n`, { ...params, n: limit - terms.length });
  } else {
    params.q = likeArg(text);
    rows = await all(`
      SELECT s.id, s.name, s.domain, s.industry FROM sites s
      WHERE (s.name ILIKE @q ESCAPE '\\' OR s.domain ILIKE @q ESCAPE '\\') AND ${pub}
        AND EXISTS (SELECT 1 FROM screens sc WHERE sc.site_id = s.id)
      ORDER BY s.name LIMIT @n`, { ...params, n: limit - terms.length });
  }
  const sites = rows.map((s) => ({ kind: "site", value: s.id, label: s.name || s.domain, sub: [s.domain, s.industry].filter(Boolean).join(" · ") }));
  return { items: [...terms, ...sites] };
}
