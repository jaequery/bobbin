// Details Inspo (details.so, formerly inspo.page). Its sitemap lists every
// /inspo/site/<slug>/ page; each page names the site, links out to it with a
// "Visit site" button and tags its industry. The sitemap carries no dates for
// these pages, so they are read in its order; pages already stored as a site's
// sourceRef are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";
import { industryFromTags } from "../industry.js";

const BASE = "https://www.details.so";
const BATCH = 50;

export const name = "details";

async function sitePages() {
  const $index = cheerio.load(await fetchHtml(`${BASE}/sitemap-index.xml`), { xml: true });
  const maps = $index("sitemap > loc").map((_, el) => $index(el).text().trim()).get().filter((u) => !u.includes("video"));
  const refs = [];
  for (const map of maps) {
    const $map = cheerio.load(await fetchHtml(map), { xml: true });
    refs.push(...$map("url > loc").map((_, el) => $map(el).text().trim()).get().filter((u) => u.startsWith(`${BASE}/inspo/site/`)));
  }
  return [...new Set(refs)];
}

export async function* listing({ limit }) {
  const refs = await sitePages();
  if (!refs.length) console.warn(`[${name}] no /inspo/site/ pages in the sitemap; its format may have changed`);
  let yielded = 0;
  for (let i = 0; i < refs.length && yielded < limit; i += BATCH) {
    const batch = refs.slice(i, i + BATCH);
    const known = await knownSourceRefs(batch);
    for (const ref of batch) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const $ = cheerio.load(await fetchHtml(ref));
      const url = $("a.visit[href^='http']").first().attr("href");
      if (!url) continue;
      const tags = $(".industry a.tag").map((_, a) => $(a).text().trim()).get();
      yielded++;
      yield { url, name: $("h1.title").first().text().trim() || null, industryHint: industryFromTags(tags), sourceRef: ref };
    }
  }
}
