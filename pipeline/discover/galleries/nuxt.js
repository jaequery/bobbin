// Nuxt's showcase (nuxt.com/showcase), sites built with Nuxt that its team picks,
// mostly large brands. One page lists every site; each card links straight out
// to the site, with no detail page, and its screenshot's alt text names it. Its
// sites span every industry.
import * as cheerio from "cheerio";
import { fetchHtml } from "../http.js";

const PAGE = "https://nuxt.com/showcase";

export const name = "nuxt";

export async function* listing({ limit }) {
  const $ = cheerio.load(await fetchHtml(PAGE));
  const entries = $("a[href^='http'][aria-label='Card link']").map((_, el) => {
    const card = $(el);
    return { url: card.attr("href"), name: card.parent().find("img[alt]").first().attr("alt")?.trim() || null, sourceRef: PAGE };
  }).get();
  if (!entries.length) console.warn(`[${name}] no entries on ${PAGE}; the gallery markup may have changed`);
  yield* entries.slice(0, limit);
}
