// SaaS Pages (saaspages.xyz). /sites lists every featured SaaS site on one page,
// each card linking to its /sites/<slug> breakdown, whose heading links out to
// the site. Every site is tagged SaaS. Pages already stored as a site's
// sourceRef are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";

const BASE = "https://saaspages.xyz";

export const name = "saaspages";

export async function* listing({ limit }) {
  const $list = cheerio.load(await fetchHtml(`${BASE}/sites`));
  const refs = [...new Set($list(".block-card h1 a[href^='/sites/']").map((_, a) => new URL($list(a).attr("href"), BASE).href).get())];
  if (!refs.length) {
    console.warn(`[${name}] no entries on ${BASE}/sites; the gallery markup may have changed`);
    return;
  }
  const known = await knownSourceRefs(refs);
  let yielded = 0;
  for (const ref of refs) {
    if (yielded >= limit) return;
    if (known.has(ref)) continue;
    const link = cheerio.load(await fetchHtml(ref))("section.hero h1 a[href^='http']").first();
    if (!link.length) continue;
    yielded++;
    yield { url: link.attr("href"), name: link.text().trim() || null, industryHint: "SaaS", sourceRef: ref };
  }
}
