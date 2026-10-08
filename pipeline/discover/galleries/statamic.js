// Statamic Showcase (statamic.com/showcase), sites built with the Statamic CMS
// that its team picks, from brands and newsrooms (Blue Origin, Der Spiegel,
// Cisco Duo) to studios and small European businesses. Its listing is paged
// with ?page=<n>, about 20 sites a page; each card links to its
// /showcase/<slug> page, whose "Visit website" button links out to the site.
// Pages already stored as a site's sourceRef are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";

const BASE = "https://statamic.com";
const MAX_PAGES = 40;

export const name = "statamic";

export async function* listing({ limit }) {
  let yielded = 0;
  for (let page = 1; page <= MAX_PAGES && yielded < limit; page++) {
    const pageUrl = `${BASE}/showcase${page > 1 ? `?page=${page}` : ""}`;
    const $list = cheerio.load(await fetchHtml(pageUrl));
    const refs = [...new Set($list("a[href^='/showcase/']").map((_, a) => $list(a).attr("href")).get()
      .filter((href) => /^\/showcase\/[\w-]+$/.test(href))
      .map((href) => BASE + href))];
    if (!refs.length) {
      if (page === 1) console.warn(`[${name}] no entries on ${pageUrl}; the gallery markup may have changed`);
      return;
    }
    const known = await knownSourceRefs(refs);
    for (const ref of refs) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const $ = cheerio.load(await fetchHtml(ref));
      const url = $("a.btn-black[target='_blank'][href^='http']").filter((_, a) => /visit website/i.test($(a).text())).first().attr("href");
      if (!url) continue;
      yielded++;
      yield { url, name: $("h1").first().text().trim() || null, sourceRef: ref };
    }
  }
}
