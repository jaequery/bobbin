// Read-only queries behind the public browse API (app/api/**). Server only, like
// lib/db.js, whose connection it uses.
//
// Only public sites are ever returned: status 'approved' (plus 'captured' when
// BOBBIN_SHOW_UNJUDGED=1, for local development) and a domain with no pending or
// approved row in `optouts`. Lists use keyset pagination: pass the returned `next` back as
// `cursor`; a cursor that does not decode starts again from the first page.
import { db, OPTOUT_BLOCKS } from "./db.js";
import { PLATFORMS, PAGE_PATTERNS, SECTION_TYPES, INDUSTRIES } from "./taxonomy.js";

// CSS widths the capture engine shoots at (pipeline/browser.js VIEWPORTS). A
// section crop's aspect is this width over its stored css height.
const VIEWPORT_WIDTH = { desktop: 1440, mobile: 390 };

// Image URL under app/shots. Screen files keep their name across re-captures, so
// they carry the capture time to get past the year-long immutable cache.
const shot = (rel, version) => (rel ? `/shots/${rel}${version ? `?v=${encodeURIComponent(version)}` : ""}` : null);

function publicStatuses() {
  return process.env.BOBBIN_SHOW_UNJUDGED === "1" ? ["approved", "captured"] : ["approved"];
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
  };
}

const likeArg = (q) => `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;

// Conditions on a screen row `sc`, its page `p` and its site `s`.
function screenWhere(f, params) {
  const where = [publicSites(params)];
  if (f.q) {
    params.q = likeArg(f.q);
    where.push(`(s.name LIKE @q ESCAPE '\\' OR s.domain LIKE @q ESCAPE '\\' OR s.tagline LIKE @q ESCAPE '\\'
      OR s.industry LIKE @q ESCAPE '\\' OR p.title LIKE @q ESCAPE '\\' OR p.pattern LIKE @q ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM sections qx WHERE qx.screen_id = sc.id AND qx.type LIKE @q ESCAPE '\\'))`);
  }
  if (f.platform) { params.platform = f.platform; where.push("sc.platform = @platform"); }
  if (f.pattern) { params.pattern = f.pattern; where.push("p.pattern = @pattern"); }
  if (f.industry) { params.industry = f.industry; where.push("s.industry = @industry"); }
  if (f.section) { params.section = f.section; where.push("EXISTS (SELECT 1 FROM sections fx WHERE fx.screen_id = sc.id AND fx.type = @section)"); }
  return where;
}

/* ---------- Cursors ---------- */

const encodeCursor = (key, id) => Buffer.from(JSON.stringify([key, id])).toString("base64url");

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const v = JSON.parse(Buffer.from(String(cursor), "base64url").toString());
    return Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && typeof v[1] === "string" ? v : null;
  } catch {
    return null;
  }
}

function clampLimit(limit, fallback) {
  const n = Number.parseInt(limit, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : fallback;
}

// Runs one keyset page of `select`, newest first. Rows must carry `sort_key`
// (the value of `keyExpr`) and `id` (the value of `idExpr`).
function page({ select, count, where, params, cursor, limit, keyExpr, idExpr }) {
  const total = db.prepare(`${count} WHERE ${where.join(" AND ")}`).get(params).n;
  const c = decodeCursor(cursor);
  const w = [...where];
  const p = { ...params, limit: limit + 1 };
  if (c) {
    w.push(`(${keyExpr} < @ck OR (${keyExpr} = @ck AND ${idExpr} < @cid))`);
    p.ck = c[0]; p.cid = c[1];
  }
  const rows = db.prepare(`${select} WHERE ${w.join(" AND ")} ORDER BY ${keyExpr} DESC, ${idExpr} DESC LIMIT @limit`).all(p);
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
    toneA: r.tone_a, toneB: r.tone_b,
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

const SCREEN_COLS = `sc.*, sc.captured_at AS sort_key, p.pattern, p.path, p.url AS page_url, p.title AS page_title,
  s.domain, s.name AS site_name, s.tone_a, s.tone_b`;

/* ---------- Public queries ---------- */

export function isPublicSite(id) {
  const params = { id };
  return !!db.prepare(`SELECT 1 FROM sites s WHERE s.id = @id AND ${publicSites(params)}`).get(params);
}

const SITE_KEY = "COALESCE(s.approved_at, s.captured_at, s.discovered_at, '')";

// Sites with at least one screen matching every filter, newest approval first.
// Each carries a desktop and a mobile cover: the home page, or the first page
// with the chosen pattern.
export function querySites(input = {}, { cursor, limit } = {}) {
  const f = cleanFilters(input);
  const params = {};
  const inner = screenWhere(f, params);
  const where = [publicSites(params), `EXISTS (SELECT 1 FROM screens sc LEFT JOIN pages p ON p.id = sc.page_id WHERE sc.site_id = s.id AND ${inner.join(" AND ")})`];
  const res = page({
    select: `SELECT s.*, ${SITE_KEY} AS sort_key FROM sites s`,
    count: "SELECT COUNT(*) AS n FROM sites s",
    where, params, cursor, limit: clampLimit(limit, 24), keyExpr: SITE_KEY, idExpr: "s.id",
  });
  const cover = db.prepare(`
    SELECT ${SCREEN_COLS} FROM screens sc JOIN sites s ON s.id = sc.site_id LEFT JOIN pages p ON p.id = sc.page_id
    WHERE sc.site_id = @siteId AND sc.platform = @platform
    ORDER BY (p.pattern = @pattern) DESC, (p.path = '/') DESC, p.path LIMIT 1`);
  res.items = res.items.map((s) => {
    const pick = (platform) => {
      if (f.platform && f.platform !== platform) return null;
      const r = cover.get({ siteId: s.id, platform, pattern: f.pattern || "Home" });
      return r ? screenOut(r) : null;
    };
    return { ...siteOut(s), cover: { desktop: pick("desktop"), mobile: pick("mobile") } };
  });
  return res;
}

export function queryScreens(input = {}, { cursor, limit } = {}) {
  const f = cleanFilters(input);
  const params = {};
  const from = "FROM screens sc JOIN sites s ON s.id = sc.site_id LEFT JOIN pages p ON p.id = sc.page_id";
  const res = page({
    select: `SELECT ${SCREEN_COLS} ${from}`,
    count: `SELECT COUNT(*) AS n ${from}`,
    where: screenWhere(f, params), params, cursor, limit: clampLimit(limit, 36),
    keyExpr: "COALESCE(sc.captured_at, '')", idExpr: "sc.id",
  });
  res.items = res.items.map(screenOut);
  return res;
}

export function querySections(input = {}, { cursor, limit } = {}) {
  const f = cleanFilters(input);
  const params = {};
  const where = screenWhere({ ...f, section: "" }, params);
  if (f.section) { params.type = f.section; where.push("x.type = @type"); }
  const from = `FROM sections x JOIN screens sc ON sc.id = x.screen_id JOIN sites s ON s.id = x.site_id
    LEFT JOIN pages p ON p.id = sc.page_id`;
  const res = page({
    select: `SELECT x.*, sc.platform, sc.captured_at AS sort_key, p.pattern, p.path, p.url AS page_url, s.domain, s.name AS site_name ${from}`,
    count: `SELECT COUNT(*) AS n ${from}`,
    where, params, cursor, limit: clampLimit(limit, 36),
    keyExpr: "COALESCE(sc.captured_at, '')", idExpr: "x.id",
  });
  res.items = res.items.map(sectionOut);
  return res;
}

// One public site with all its pages, screens and sections, or null.
export function querySite(id) {
  if (!isPublicSite(id)) return null;
  const s = db.prepare("SELECT * FROM sites WHERE id = ?").get(id);
  const screens = db.prepare(`
    SELECT ${SCREEN_COLS} FROM screens sc JOIN sites s ON s.id = sc.site_id LEFT JOIN pages p ON p.id = sc.page_id
    WHERE sc.site_id = ? ORDER BY (p.path = '/') DESC, p.path, sc.platform`).all(id).map(screenOut);
  const sections = db.prepare(`
    SELECT x.*, sc.platform, p.pattern, p.path, p.url AS page_url, s.domain, s.name AS site_name
    FROM sections x JOIN screens sc ON sc.id = x.screen_id JOIN sites s ON s.id = x.site_id LEFT JOIN pages p ON p.id = sc.page_id
    WHERE x.site_id = ? ORDER BY (p.path = '/') DESC, p.path, x.y`).all(id).map(sectionOut);
  const pages = db.prepare("SELECT id, path, url, pattern, title, captured_at FROM pages WHERE site_id = ? ORDER BY (path = '/') DESC, path").all(id)
    .map((p) => ({ id: p.id, path: p.path, url: p.url, pattern: p.pattern, title: p.title, capturedAt: p.captured_at }));
  return { ...siteOut(s), pages, screens, sections };
}

// The taxonomy with how many public items carry each value, for the filter menus.
export function libraryMeta() {
  const params = {};
  const pub = publicSites(params);
  const tally = (sql) => Object.fromEntries(db.prepare(sql).all(params).map((r) => [r.k, r.n]));
  const screensFrom = `FROM screens sc JOIN sites s ON s.id = sc.site_id LEFT JOIN pages p ON p.id = sc.page_id WHERE ${pub}`;
  const byPlatform = tally(`SELECT sc.platform AS k, COUNT(*) AS n ${screensFrom} GROUP BY 1`);
  const byPattern = tally(`SELECT p.pattern AS k, COUNT(*) AS n ${screensFrom} GROUP BY 1`);
  const byType = tally(`SELECT x.type AS k, COUNT(*) AS n FROM sections x JOIN sites s ON s.id = x.site_id WHERE ${pub} GROUP BY 1`);
  const byIndustry = tally(`SELECT s.industry AS k, COUNT(*) AS n FROM sites s WHERE ${pub} AND EXISTS (SELECT 1 FROM screens sc WHERE sc.site_id = s.id) GROUP BY 1`);
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  return {
    totals: { sites: sum(byIndustry), screens: sum(byPlatform), sections: sum(byType) },
    platforms: PLATFORMS.map((p) => ({ value: p.id, label: p.label, count: byPlatform[p.id] || 0 })),
    patterns: PAGE_PATTERNS.map((v) => ({ value: v, label: v, count: byPattern[v] || 0 })),
    sections: SECTION_TYPES.map((v) => ({ value: v, label: v, count: byType[v] || 0 })),
    industries: INDUSTRIES.map((v) => ({ value: v, label: v, count: byIndustry[v] || 0 })),
  };
}
