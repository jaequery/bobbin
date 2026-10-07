// Semplice Showcase (semplice.com/showcase), portfolio sites built with
// Semplice. One page lists every site; each card links out to the site and
// names it in its .showcase-meta block.
import * as cheerio from "cheerio";
import { fetchHtml } from "../http.js";

const BASE = "https://www.semplice.com";

export const name = "semplice";

export async function* listing({ limit }) {
  const $ = cheerio.load(await fetchHtml(`${BASE}/showcase`));
  const entries = $(".showcase-meta .name a[href^='http']").map((_, el) => {
    const link = $(el);
    return { url: link.attr("href"), name: link.text().trim() || null, sourceRef: `${BASE}/showcase` };
  }).get();
  if (!entries.length) console.warn(`[${name}] no entries on ${BASE}/showcase; the gallery markup may have changed`);
  yield* entries.slice(0, limit);
}
