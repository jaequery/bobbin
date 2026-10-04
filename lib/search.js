// The full-text index behind `q` (db/migrations/002_search.sql). Server only,
// like lib/db.js, whose connection it uses.
//
// search_idx has one row per page carrying its site's fields, so a match on a
// site's name finds all its pages and a match on "Pricing" only its pricing
// page. Every write path that changes what is indexed calls reindexSite: the
// capture engine, the judge and the tagger. `npm run search:reindex` rebuilds
// everything after a missed hook.
import { db } from "./db.js";
import { countryName, isCountryCode } from "./regions.js";

// bm25 weights per column, in table order: site_id, page_id, name, domain,
// tagline, description, industry, country, pattern, title, sections.
export const RANK = "bm25(search_idx, 0, 0, 10, 10, 3, 1, 3, 2, 5, 2, 2)";

const PAGE_ROWS = `
  SELECT s.id AS site_id, p.id AS page_id, coalesce(s.name, '') AS name, s.domain,
         coalesce(s.tagline, '') AS tagline, coalesce(s.description, '') AS description,
         coalesce(s.industry, '') AS industry, s.country, coalesce(p.pattern, '') AS pattern,
         coalesce(p.title, '') AS title,
         (SELECT coalesce(group_concat(DISTINCT x.type), '') FROM screens sc JOIN sections x ON x.screen_id = sc.id
          WHERE sc.page_id = p.id AND x.type IS NOT NULL) AS sections
  FROM pages p JOIN sites s ON s.id = p.site_id`;

const INSERT = `INSERT INTO search_idx (site_id, page_id, name, domain, tagline, description, industry, country, pattern, title, sections)
  VALUES (@site_id, @page_id, @name, @domain, @tagline, @description, @industry, @country, @pattern, @title, @sections)`;

// The country column holds the code and its English name: "JP Japan".
const withCountry = (r) => ({ ...r, country: isCountryCode(r.country) ? `${r.country} ${countryName(r.country)}` : "" });

// Replaces a site's rows with its current pages. A deleted site's rows go away.
export function reindexSite(siteId) {
  db.transaction(() => {
    db.prepare("DELETE FROM search_idx WHERE site_id = ?").run(siteId);
    const insert = db.prepare(INSERT);
    for (const r of db.prepare(`${PAGE_ROWS} WHERE s.id = ?`).all(siteId)) insert.run(withCountry(r));
  })();
}

// Rebuilds the whole index. Returns the number of rows written.
export function reindexAll() {
  return db.transaction(() => {
    db.prepare("DELETE FROM search_idx").run();
    const insert = db.prepare(INSERT);
    const rows = db.prepare(PAGE_ROWS).all();
    for (const r of rows) insert.run(withCountry(r));
    return rows.length;
  })();
}

// A database migrated before any reindex (or written by code without the hooks)
// has fewer index rows than pages: rebuild once per process when that happens.
export function ensureIndex() {
  if (globalThis.__jethroSearchChecked) return;
  globalThis.__jethroSearchChecked = true;
  const rows = db.prepare("SELECT count(*) FROM search_idx").pluck().get();
  const pages = db.prepare("SELECT count(*) FROM pages").pluck().get();
  if (rows !== pages) reindexAll();
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

// The FTS5 MATCH expression for a visitor's query, or null when `q` should use
// plain LIKE matching instead: a single character, CJK text (unicode61 does not
// split it into words), or nothing word-like at all. Each word becomes a quoted
// prefix term, so quotes, `*`, `-`, AND/OR/NOT/NEAR and column filters are only
// ever searched for, never interpreted.
export function searchQuery(q) {
  const text = String(q || "").trim();
  if (text.length < 2 || CJK.test(text)) return null;
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (!words) return null;
  return words.slice(0, 8).map((w) => `"${w}"*`).join(" ");
}
