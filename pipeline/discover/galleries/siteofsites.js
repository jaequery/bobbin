// Site of Sites (siteofsites.co), a Wix site. Its sitemap index names a
// dynamic-websites sitemap of every /websites/<slug> page, read newest first;
// each page's first external link is the site (related sites follow it). Pages
// already stored as a site's sourceRef are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";

const BASE = "https://www.siteofsites.co";
const BATCH = 50;

export const name = "siteofsites";

async function sitePages() {
  const $index = cheerio.load(await fetchHtml(`${BASE}/sitemap.xml`), { xml: true });
  const map = $index("sitemap > loc").map((_, el) => $index(el).text().trim()).get().find((u) => u.includes("/dynamic-websites"));
  if (!map) return [];
  const $map = cheerio.load(await fetchHtml(map), { xml: true });
  return $map("url")
    .map((_, el) => ({ ref: $map(el).find("loc").text().trim(), mod: $map(el).find("lastmod").text().trim() }))
    .get()
    .filter((p) => p.ref.startsWith(`${BASE}/websites/`))
    .sort((a, b) => b.mod.localeCompare(a.mod))
    .map((p) => p.ref);
}

export async function* listing({ limit }) {
  const refs = await sitePages();
  if (!refs.length) console.warn(`[${name}] no /websites/ pages in the sitemap; its format may have changed`);
  let yielded = 0;
  for (let i = 0; i < refs.length && yielded < limit; i += BATCH) {
    const batch = refs.slice(i, i + BATCH);
    const known = await knownSourceRefs(batch);
    for (const ref of batch) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const $ = cheerio.load(await fetchHtml(ref));
      const url = $("a[target='_blank'][href^='http']")
        .map((_, a) => $(a).attr("href")).get()
        .find((href) => !/(^|\.)(siteofsites\.co|wix\.com)$/.test(new URL(href).hostname));
      if (!url) continue;
      yielded++;
      yield { url, name: $("h1").first().text().trim() || null, sourceRef: ref };
    }
  }
}
