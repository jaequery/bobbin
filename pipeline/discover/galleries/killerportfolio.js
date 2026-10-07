// Killer Portfolio, a curated gallery of portfolio sites from designers,
// developers and studios. Its showcase lists them newest first, paged with
// /showcase/page/<n>; each card links to its /by/<slug> page, whose button links
// out to the site with ?ref=killerportfolio. Every site is tagged Agency &
// Portfolio. Pages already stored as a site's sourceRef are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";

const BASE = "https://www.killerportfolio.com";
const MAX_PAGES = 30;

export const name = "killerportfolio";

export async function* listing({ limit }) {
  let yielded = 0;
  for (let page = 1; page <= MAX_PAGES && yielded < limit; page++) {
    const pageUrl = page > 1 ? `${BASE}/showcase/page/${page}` : `${BASE}/`;
    const $list = cheerio.load(await fetchHtml(pageUrl));
    const refs = [...new Set($list("a[href^='/by/']").map((_, a) => new URL($list(a).attr("href"), BASE).href).get())];
    if (!refs.length) {
      if (page === 1) console.warn(`[${name}] no entries on ${pageUrl}; the gallery markup may have changed`);
      return;
    }
    const known = await knownSourceRefs(refs);
    for (const ref of refs) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const $ = cheerio.load(await fetchHtml(ref));
      const url = $("a[href^='http'][href*='ref=killerportfolio']").first().attr("href");
      if (!url) continue;
      yielded++;
      yield { url, name: $("h1").first().text().trim() || null, industryHint: "Agency & Portfolio", sourceRef: ref };
    }
  }
}
