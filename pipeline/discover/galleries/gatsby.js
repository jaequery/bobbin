// Gatsby's showcase (gatsbyjs.com/showcase), sites built with Gatsby. Its
// listing loads more cards client-side, so its sitemap is read instead, in
// sitemap order (newest first; it carries no per-page lastmod). Each
// /showcase/<host>[/<path>] page is named for the site it shows, so the slug is
// the site URL; the page is fetched for its title and categories, mapped to
// industry. Pages already stored as a site's sourceRef are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";
import { industryFromTags } from "../industry.js";

const BASE = "https://www.gatsbyjs.com";
const BATCH = 50;

export const name = "gatsby";

export async function* listing({ limit }) {
  const $map = cheerio.load(await fetchHtml(`${BASE}/sitemap/sitemap-0.xml`), { xml: true });
  const refs = [...new Set($map("url > loc").map((_, el) => $map(el).text().trim()).get()
    .filter((ref) => ref.startsWith(`${BASE}/showcase/`) && ref.length > `${BASE}/showcase/`.length))];
  if (!refs.length) console.warn(`[${name}] no /showcase/ pages in the sitemap; its format may have changed`);
  let yielded = 0;
  for (let i = 0; i < refs.length && yielded < limit; i += BATCH) {
    const batch = refs.slice(i, i + BATCH);
    const known = await knownSourceRefs(batch);
    for (const ref of batch) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const $ = cheerio.load(await fetchHtml(ref));
      const tags = $("a[href*='/showcase/?filters']").map((_, a) => $(a).text().trim()).get().filter((t) => t !== "Featured");
      yielded++;
      yield {
        url: "https://" + ref.slice(`${BASE}/showcase/`.length),
        name: $("h1").first().text().trim() || null,
        industryHint: industryFromTags(tags),
        sourceRef: ref,
      };
    }
  }
}
