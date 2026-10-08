// Made with Wagtail (madewithwagtail.org), a community showcase of about 1,000
// production sites built with the Wagtail CMS, from NASA JPL, Google's blog and
// Mozilla to museums, universities, newsrooms and studios. Its home page lists
// sites newest first, 12 a page, paged with /page/<n>; each card links to a
// /developers/<developer>/<site>/ page whose JSON-LD names the site's URL and
// its sector and capability tags, which are mapped to an industry. Pages
// already stored as a site's sourceRef are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";
import { industryFromTags } from "../industry.js";

const BASE = "https://madewithwagtail.org";
const MAX_PAGES = 100;

export const name = "wagtail";

// The CreativeWork node of a site page's JSON-LD graph, or null.
function creativeWork($) {
  for (const el of $("script[type='application/ld+json']").get()) {
    try {
      const graph = [].concat(JSON.parse($(el).text())?.["@graph"] ?? []);
      const work = graph.find((n) => n?.["@type"] === "CreativeWork");
      if (work) return work;
    } catch {}
  }
  return null;
}

export async function* listing({ limit }) {
  let yielded = 0;
  for (let page = 1; page <= MAX_PAGES && yielded < limit; page++) {
    const pageUrl = page > 1 ? `${BASE}/page/${page}` : `${BASE}/`;
    const $list = cheerio.load(await fetchHtml(pageUrl));
    const refs = [...new Set($list("a[href^='/developers/']").map((_, a) => $list(a).attr("href")).get()
      .filter((href) => /^\/developers\/[\w-]+\/[\w-]+\/$/.test(href))
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
      const work = creativeWork($);
      const url = work?.url || $("a.btn").filter((_, a) => /visit site/i.test($(a).text())).first().attr("href");
      if (!url || !/^https?:\/\//i.test(url)) continue;
      yielded++;
      yield {
        url,
        name: work?.name?.trim() || $("h1").first().text().trim() || null,
        industryHint: industryFromTags(String(work?.keywords ?? "").split(",").map((s) => s.trim())),
        sourceRef: ref,
      };
    }
  }
}
