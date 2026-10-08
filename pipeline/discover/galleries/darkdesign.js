// Dark Design (dark.design), dark-themed sites its curator picks, mostly
// software and AI products, studios and personal portfolios (Linear, Basement,
// Antimetal, Arc). One page lists every site: each card links to its
// /site/<slug> page and has a "Visit site" link straight out to the site, plus
// a category mapped to industry. Sponsored cards have no /site/ page and are
// skipped.
import * as cheerio from "cheerio";
import { fetchHtml } from "../http.js";
import { industryFromTags } from "../industry.js";

const BASE = "https://www.dark.design";

export const name = "darkdesign";

export async function* listing({ limit }) {
  const $ = cheerio.load(await fetchHtml(BASE));
  const entries = $("a[href^='/site/']").map((_, el) => {
    const card = $(el).parent();
    const url = card.find("a[title='Visit site'][href^='http']").first().attr("href");
    if (!url) return null;
    const label = card.find("p span");
    return {
      url,
      name: label.eq(0).text().trim() || null,
      industryHint: industryFromTags(label.eq(1).text().replace(/^·\s*/, "").trim()),
      sourceRef: BASE + $(el).attr("href"),
    };
  }).get();
  if (!entries.length) console.warn(`[${name}] no entries on ${BASE}; the gallery markup may have changed`);
  yield* entries.slice(0, limit);
}
