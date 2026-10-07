// Dead Simple Sites (deadsimplesites.com), a gallery of minimal websites. One
// page lists every site, newest first; each card links out to the site and
// names it in an <h3>.
import * as cheerio from "cheerio";
import { fetchHtml } from "../http.js";

const BASE = "https://deadsimplesites.com";

export const name = "deadsimplesites";

export async function* listing({ limit }) {
  const $ = cheerio.load(await fetchHtml(`${BASE}/`));
  const entries = $("a[target='_blank'][href^='http']:has(h3)").map((_, el) => {
    const card = $(el);
    return { url: card.attr("href"), name: card.find("h3").text().trim() || null, sourceRef: `${BASE}/` };
  }).get();
  if (!entries.length) console.warn(`[${name}] no entries on ${BASE}/; the gallery markup may have changed`);
  yield* entries.slice(0, limit);
}
