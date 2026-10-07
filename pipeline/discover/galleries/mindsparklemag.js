// Mindsparkle Mag (mindsparklemag.com). robots.txt disallows its ?page= listing,
// so the sitemap index's websites sitemap of every /website/<slug> post is read
// newest first; each post has a "Visit website" link to the site and its
// categories. Posts already stored as a site's sourceRef are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";
import { industryFromTags } from "../industry.js";

const BASE = "https://mindsparklemag.com";
const BATCH = 50;

export const name = "mindsparklemag";

async function posts() {
  const $index = cheerio.load(await fetchHtml(`${BASE}/sitemap.xml`), { xml: true });
  const map = $index("sitemap > loc").map((_, el) => $index(el).text().trim()).get().find((u) => u.endsWith("/websites.xml"));
  if (!map) return [];
  const $map = cheerio.load(await fetchHtml(map), { xml: true });
  return $map("url")
    .map((_, el) => ({ ref: $map(el).find("loc").text().trim(), mod: $map(el).find("lastmod").text().trim() }))
    .get()
    .filter((p) => p.ref.startsWith(`${BASE}/website/`))
    .sort((a, b) => b.mod.localeCompare(a.mod))
    .map((p) => p.ref);
}

export async function* listing({ limit }) {
  const refs = await posts();
  if (!refs.length) console.warn(`[${name}] no /website/ posts in the sitemap; its format may have changed`);
  let yielded = 0;
  for (let i = 0; i < refs.length && yielded < limit; i += BATCH) {
    const batch = refs.slice(i, i + BATCH);
    const known = await knownSourceRefs(batch);
    for (const ref of batch) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const $ = cheerio.load(await fetchHtml(ref));
      const url = $("a.detail-btn[target='_blank'][href^='http']").first().attr("href");
      if (!url) continue;
      const categories = $("a[href^='https://mindsparklemag.com/categories/']").map((_, a) => $(a).text().trim()).get();
      yielded++;
      yield {
        url,
        name: $("h1.dt-heading").first().text().trim() || null,
        industryHint: industryFromTags(categories),
        sourceRef: ref,
      };
    }
  }
}
