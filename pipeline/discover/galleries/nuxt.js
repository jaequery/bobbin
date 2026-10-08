// Nuxt's showcase (nuxt.com/showcase), well-known sites built with Nuxt that
// its team picks, from Louis Vuitton to NASA's JPL. One page lists them all;
// every card links straight out to the site, with no detail page, so the
// listing page is the source. Its sites span every industry.
import { paged } from "./paged.js";

const BASE = "https://nuxt.com";

export const name = "nuxt";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    maxPages: 1,
    pageUrl: () => `${BASE}/showcase`,
    parse: ($, pageUrl) =>
      $("a[aria-label='Card link'][href^='http']").map((_, el) => {
        const card = $(el);
        const label = card.parent().find("p").first().text().trim();
        return { url: card.attr("href"), name: label || null, sourceRef: pageUrl };
      }).get(),
  });
}
