// Typewolf Site of the Day. Listing pages (?page=N) link to /site-of-the-day/<slug>
// detail pages, whose heading links out to the site. Detail pages already stored
// as a site's sourceRef are not fetched again, so each run reaches further back.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";

const BASE = "https://www.typewolf.com";
const MAX_PAGES = 50;

export const name = "typewolf";

function detailRefs($) {
  const refs = $(".item-title a[href^='/site-of-the-day/']").map((_, a) => new URL($(a).attr("href"), BASE).href).get();
  return [...new Set(refs)];
}

export async function* listing({ limit }) {
  let yielded = 0;
  for (let page = 1; page <= MAX_PAGES && yielded < limit; page++) {
    const pageUrl = `${BASE}/site-of-the-day${page > 1 ? `?page=${page}` : ""}`;
    const refs = detailRefs(cheerio.load(await fetchHtml(pageUrl)));
    if (!refs.length) {
      if (page === 1) console.warn(`[${name}] no entries on ${pageUrl}; the gallery markup may have changed`);
      return;
    }
    const known = await knownSourceRefs(refs);
    for (const ref of refs) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const link = cheerio.load(await fetchHtml(ref))(".sotd-header h1 a[href^='http']").first();
      if (!link.length) continue;
      yielded++;
      yield { url: link.attr("href"), name: link.text().trim() || null, sourceRef: ref };
    }
  }
}
