// Orpetron (orpetron.com), web design awards. /sites/page/<n>/ lists awarded
// and nominated sites newest first, each card linking to its /sites/<slug>/
// page, which links out to the site with a "Visit Site" button. Pages already
// stored as a site's sourceRef are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";

const BASE = "https://orpetron.com";
const MAX_PAGES = 500;

export const name = "orpetron";

function cards($) {
  const seen = new Set();
  return $("article.website-card h3.website-card__title a[href]").map((_, a) => {
    const ref = new URL($(a).attr("href"), BASE).href;
    if (seen.has(ref) || !/^https:\/\/orpetron\.com\/sites\/[^/]+\/$/.test(ref)) return null;
    seen.add(ref);
    return { ref, name: $(a).text().trim() || null };
  }).get();
}

export async function* listing({ limit }) {
  let yielded = 0;
  for (let page = 1; page <= MAX_PAGES && yielded < limit; page++) {
    const pageUrl = page > 1 ? `${BASE}/sites/page/${page}/` : `${BASE}/sites/`;
    const entries = cards(cheerio.load(await fetchHtml(pageUrl)));
    if (!entries.length) {
      if (page === 1) console.warn(`[${name}] no entries on ${pageUrl}; the gallery markup may have changed`);
      return;
    }
    const known = await knownSourceRefs(entries.map((e) => e.ref));
    for (const { ref, name: siteName } of entries) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const $ = cheerio.load(await fetchHtml(ref));
      const url = $("a.pill-btn[href^='http']").filter((_, a) => $(a).text().trim() === "Visit Site").first().attr("href");
      if (!url) continue;
      yielded++;
      yield { url, name: siteName, sourceRef: ref };
    }
  }
}
