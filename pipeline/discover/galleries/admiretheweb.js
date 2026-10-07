// Admire the Web. Each listing page links to /inspiration/<slug>/ detail pages,
// and each detail page's screenshot links out to its site. Detail pages already stored as a
// site's sourceRef are not fetched again, so each run reaches further back.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";

const BASE = "https://admiretheweb.com";
const MAX_PAGES = 50;

export const name = "admiretheweb";

function detailRefs($) {
  const refs = $("a[href^='/inspiration/']")
    .map((_, a) => new URL($(a).attr("href"), BASE).href).get()
    .filter((href) => /^https:\/\/admiretheweb\.com\/inspiration\/[^/]+\/$/.test(href) && !href.includes("/inspiration/tag/"));
  return [...new Set(refs)];
}

export async function* listing({ limit }) {
  let yielded = 0;
  for (let page = 1; page <= MAX_PAGES && yielded < limit; page++) {
    const pageUrl = page > 1 ? `${BASE}/page/${page}/` : `${BASE}/`;
    const refs = detailRefs(cheerio.load(await fetchHtml(pageUrl)));
    if (!refs.length) {
      if (page === 1) console.warn(`[${name}] no entries on ${pageUrl}; the gallery markup may have changed`);
      return;
    }
    const known = await knownSourceRefs(refs);
    for (const ref of refs) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const $ = cheerio.load(await fetchHtml(ref));
      const url = $(".block-inspiration__item .c-item__image a[href^='http']").attr("href");
      if (!url) continue;
      yielded++;
      yield { url, name: $("h1").first().text().trim() || null, sourceRef: ref };
    }
  }
}
