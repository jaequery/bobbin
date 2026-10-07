// A1 Gallery (a1.gallery). Its sitemap lists every /website/<slug> page newest
// first; each page links out to the site with a ?ref=a1.gallery button and tags
// it with a type and a category, mapped to an industry. Template entries, whose
// button goes to a template store, are skipped. Pages already stored as a site's
// sourceRef are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";
import { industryFromTags } from "../industry.js";

const BASE = "https://www.a1.gallery";
const BATCH = 50;

export const name = "a1gallery";

export async function* listing({ limit }) {
  const $map = cheerio.load(await fetchHtml(`${BASE}/sitemap.xml`), { xml: true });
  const refs = $map("url > loc").map((_, el) => $map(el).text().trim()).get().filter((u) => u.startsWith(`${BASE}/website/`));
  if (!refs.length) console.warn(`[${name}] no /website/ pages in the sitemap; its format may have changed`);
  let yielded = 0;
  for (let i = 0; i < refs.length && yielded < limit; i += BATCH) {
    const batch = refs.slice(i, i + BATCH);
    const known = await knownSourceRefs(batch);
    for (const ref of batch) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const $ = cheerio.load(await fetchHtml(ref));
      const url = $("a.button[href^='http'][href*='ref=a1.gallery']").not(".is-secondary").first().attr("href");
      if (!url) continue;
      const tags = $("a.link-wrapper[href^='/type/'], a.link-wrapper[href^='/category/']")
        .map((_, a) => $(a).attr("href").split("/").pop().replace(/-/g, " ")).get();
      yielded++;
      yield { url, name: $("h1").first().text().trim() || null, industryHint: industryFromTags(tags), sourceRef: ref };
    }
  }
}
