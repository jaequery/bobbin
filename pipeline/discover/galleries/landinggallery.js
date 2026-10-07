// Landing Gallery (landing.gallery). Its sitemap lists every /websites/<slug>
// page newest first; each page links out to the site with a
// ?utm_source=landing.gallery link. Pages already stored as a site's sourceRef
// are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";

const BASE = "https://www.landing.gallery";
const BATCH = 50;

export const name = "landinggallery";

export async function* listing({ limit }) {
  const $map = cheerio.load(await fetchHtml(`${BASE}/sitemap.xml`), { xml: true });
  const refs = $map("url > loc").map((_, el) => $map(el).text().trim()).get().filter((u) => u.startsWith(`${BASE}/websites/`));
  if (!refs.length) console.warn(`[${name}] no /websites/ pages in the sitemap; its format may have changed`);
  let yielded = 0;
  for (let i = 0; i < refs.length && yielded < limit; i += BATCH) {
    const batch = refs.slice(i, i + BATCH);
    const known = await knownSourceRefs(batch);
    for (const ref of batch) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const $ = cheerio.load(await fetchHtml(ref));
      const url = $("a[href^='http'][href*='utm_source=landing.gallery']").first().attr("href");
      if (!url) continue;
      yielded++;
      yield { url, name: $("h1#modal-website-title").first().text().trim() || null, sourceRef: ref };
    }
  }
}
