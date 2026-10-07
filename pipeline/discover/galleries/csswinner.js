// CSS Winner (csswinner.com). Each /winners/<n> page lists Sites of the Day,
// newest first; every card links to its /details/<slug>/<id> page and out to
// the site.
import { paged } from "./paged.js";

const BASE = "https://www.csswinner.com";

export const name = "csswinner";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => `${BASE}/winners${n > 1 ? `/${n}` : ""}`,
    parse: ($) =>
      $("li:has(> div > figure a[href*='/details/'])").map((_, el) => {
        const card = $(el);
        const url = card.find("figure a[target='_blank'][href^='http']").attr("href");
        const detail = card.find("h3 a[href*='/details/']").first();
        if (!url || !detail.length) return null;
        return { url, name: detail.text().trim() || null, sourceRef: new URL(detail.attr("href"), BASE).href };
      }).get(),
  });
}
