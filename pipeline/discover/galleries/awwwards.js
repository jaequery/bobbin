// Awwwards Sites of the Day. Each card links out to the site and to its
// /sites/<slug> detail page.
import { paged } from "./paged.js";

const BASE = "https://www.awwwards.com";

export const name = "awwwards";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => `${BASE}/websites/sites_of_the_day/${n > 1 ? `?page=${n}` : ""}`,
    parse: ($) =>
      $(".card-site").map((_, el) => {
        const card = $(el);
        const url = card.find("a.figure-rollover__bt[href^='http']").attr("href");
        const detail = card.find("a.figure-rollover__link").attr("href");
        if (!url || !detail) return null;
        return {
          url,
          name: card.find("a.figure-rollover__link").attr("aria-label") || null,
          sourceRef: new URL(detail, BASE).href,
        };
      }).get(),
  });
}
