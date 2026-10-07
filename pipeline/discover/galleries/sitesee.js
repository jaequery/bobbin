// SiteSee (sitesee.co). The home page loads more sites client-side, but its
// sitemap lists every /entry/<slug> page newest first; each page names the site,
// links out to it with a "Visit" button and lists its tags. Pages already
// stored as a site's sourceRef are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";
import { industryFromTags } from "../industry.js";

const BASE = "https://sitesee.co";
const BATCH = 50;

export const name = "sitesee";

export async function* listing({ limit }) {
  const $map = cheerio.load(await fetchHtml(`${BASE}/sitemap.xml`), { xml: true });
  const refs = $map("url > loc").map((_, el) => $map(el).text().trim()).get().filter((u) => u.startsWith(`${BASE}/entry/`));
  if (!refs.length) console.warn(`[${name}] no /entry/ pages in the sitemap; its format may have changed`);
  let yielded = 0;
  for (let i = 0; i < refs.length && yielded < limit; i += BATCH) {
    const batch = refs.slice(i, i + BATCH);
    const known = await knownSourceRefs(batch);
    for (const ref of batch) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const $ = cheerio.load(await fetchHtml(ref));
      const url = $("main a[target='_blank'][href^='http']").filter((_, a) => $(a).text().trim() === "Visit").first().attr("href");
      if (!url) continue;
      const tags = $("main h3:contains('Tags') + ul a[href^='/?tags=']").map((_, a) => $(a).text().trim()).get();
      yielded++;
      yield { url, name: $("main h1").first().text().trim() || null, industryHint: industryFromTags(tags), sourceRef: ref };
    }
  }
}
