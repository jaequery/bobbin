// The full-text index behind `q` (db/migrations/002_search.sql). Server only,
// like lib/db.js, whose connection it uses.
//
// search_idx has one row per page carrying its site's fields, so a match on a
// site's name finds all its pages and a match on "Pricing" only its pricing
// page. Every write path that changes what is indexed calls reindexSite: the
// capture engine, the judge and the tagger. `npm run search:reindex` rebuilds
// everything after a missed hook.
import { all, run, tx, value } from "./db.js";
import { countryName, isCountryCode } from "./regions.js";

// Postgres text-search weights per field (A weighs most, D least).
const WEIGHTS = {
  name: "A", domain: "A", pattern: "B", tagline: "B", industry: "B",
  country: "C", title: "C", sections: "C", description: "D",
};

// A score per matching page, higher is better. Takes the tsquery as @fts.
export const RANK = "ts_rank(vec, to_tsquery('simple', @fts))";
export const MATCH = "vec @@ to_tsquery('simple', @fts)";

const PAGE_ROWS = `
  SELECT s.id AS site_id, p.id AS page_id, s.name, s.domain, s.tagline, s.description,
         s.industry, s.country, p.pattern, p.title,
         (SELECT string_agg(DISTINCT x.type, ' ') FROM screens sc JOIN sections x ON x.screen_id = sc.id
          WHERE sc.page_id = p.id AND x.type IS NOT NULL) AS sections
  FROM pages p JOIN sites s ON s.id = p.site_id`;

// Lowercase words without diacritics, split on anything not a letter or digit,
// so "Stripe.com" indexes as "stripe com" and "Café" matches "cafe".
const words = (v) => String(v ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// The country field holds the code and its English name: "JP Japan".
function fieldsOf(r) {
  return { ...r, country: isCountryCode(r.country) ? `${r.country} ${countryName(r.country)}` : "" };
}

async function insertRows(rows) {
  if (!rows.length) return;
  const params = {};
  const tuples = rows.map((r, i) => {
    const f = fieldsOf(r);
    params[`p${i}`] = r.page_id;
    params[`s${i}`] = r.site_id;
    const vec = Object.entries(WEIGHTS).map(([k, w]) => {
      params[`${k}${i}`] = words(f[k]);
      return `setweight(to_tsvector('simple', @${k}${i}), '${w}')`;
    }).join(" || ");
    return `(@p${i}, @s${i}, ${vec})`;
  });
  await run(`INSERT INTO search_idx (page_id, site_id, vec) VALUES ${tuples.join(", ")}`, params);
}

// Replaces a site's rows with its current pages. A deleted site's rows go away.
export function reindexSite(siteId) {
  return tx(async () => {
    await run("DELETE FROM search_idx WHERE site_id = @siteId", { siteId });
    await insertRows(await all(`${PAGE_ROWS} WHERE s.id = @siteId`, { siteId }));
  });
}

// Rebuilds the whole index. Returns the number of rows written.
export function reindexAll() {
  return tx(async () => {
    await run("DELETE FROM search_idx");
    const rows = await all(PAGE_ROWS);
    for (let i = 0; i < rows.length; i += 200) await insertRows(rows.slice(i, i + 200));
    return rows.length;
  });
}

// A database written by code without the hooks has fewer index rows than
// pages: rebuild once per process when that happens.
export async function ensureIndex() {
  if (globalThis.__jethroSearchChecked) return;
  globalThis.__jethroSearchChecked = true;
  const rows = await value("SELECT count(*) FROM search_idx");
  const pages = await value("SELECT count(*) FROM pages");
  if (rows !== pages) await reindexAll();
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

// The tsquery for a visitor's query, or null when `q` should use plain ILIKE
// matching instead: a single character, CJK text (not split into words), or
// nothing word-like at all. Each word becomes a prefix term ANDed with the
// rest; only letters and digits ever reach the tsquery, so no operator in `q`
// is ever interpreted.
export function searchQuery(q) {
  const text = String(q || "").trim();
  if (text.length < 2 || CJK.test(text)) return null;
  const ws = words(text).split(" ").filter(Boolean);
  if (!ws.length) return null;
  return ws.slice(0, 8).map((w) => `${w}:*`).join(" & ");
}
