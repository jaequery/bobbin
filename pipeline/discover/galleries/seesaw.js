// See*Saw (seesaw.website). Its home page lists every /websites/<slug> page newest
// first; each page links out to the site with a ?ref=seesaw button and tags it
// with categories, mapped to an industry. Pages already stored as a site's
// sourceRef are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";
import { industryFromTags } from "../industry.js";

const BASE = "https://www.seesaw.website";
const BATCH = 50;

// Category slugs that need rewording before industryFromTags can match them.
const SLUG_TAGS = { "venture-capital": "investment", venture: "investment", "design-tools": "software" };

export const name = "seesaw";

export async function* listing({ limit }) {
  const $home = cheerio.load(await fetchHtml(`${BASE}/`));
  const refs = [...new Set($home("a[href^='/websites/']").map((_, a) => new URL($home(a).attr("href"), BASE).href).get())];
  if (!refs.length) console.warn(`[${name}] no /websites/ links on ${BASE}/; the gallery markup may have changed`);
  let yielded = 0;
  for (let i = 0; i < refs.length && yielded < limit; i += BATCH) {
    const batch = refs.slice(i, i + BATCH);
    const known = await knownSourceRefs(batch);
    for (const ref of batch) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const $ = cheerio.load(await fetchHtml(ref));
      const url = $("a[href^='http'][href*='ref=seesaw']").first().attr("href");
      if (!url) continue;
      const tags = $("a[href^='/category/']").map((_, a) => $(a).attr("href").split("/").pop()).get();
      yielded++;
      yield {
        url,
        name: $("h1").first().text().trim() || null,
        industryHint: industryFromTags(tags.map((s) => SLUG_TAGS[s] ?? s.replace(/-/g, " "))),
        sourceRef: ref,
      };
    }
  }
}
