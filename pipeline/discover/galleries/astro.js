// Astro's showcase (astro.build/showcase), sites built with Astro that its team
// picks for the gallery. It lists them newest first, paged with
// /showcase/<n>/; every card links straight out to the site, with no detail
// page, so the listing page is the source. Its sites span every industry.
import { paged } from "./paged.js";

const BASE = "https://astro.build";

export const name = "astro";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    maxPages: 120,
    pageUrl: (n) => `${BASE}/showcase/${n > 1 ? `${n}/` : ""}`,
    parse: ($, pageUrl) =>
      $("article > a[href^='http'][target='_blank']").map((_, el) => {
        const card = $(el);
        return { url: card.attr("href"), name: card.find("h2").first().text().trim() || null, sourceRef: pageUrl };
      }).get(),
  });
}
