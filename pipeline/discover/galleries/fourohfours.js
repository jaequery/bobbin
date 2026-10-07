// 404s.design, a gallery of 404 pages from well-designed sites. Its home page
// lists them newest first, paged with Webflow's ?c1c0ca5c_page=<n>; every card
// links to its /sites/<slug> page and out to the site's 404 page, which
// normalization reduces to the domain. Its tags describe style, not industry.
import { paged } from "./paged.js";

const BASE = "https://www.404s.design";

export const name = "404s";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    maxPages: 30,
    pageUrl: (n) => (n > 1 ? `${BASE}/?c1c0ca5c_page=${n}` : `${BASE}/`),
    parse: ($) =>
      $(".gallery_item:has(a[href^='/sites/'])").map((_, el) => {
        const card = $(el);
        const url = card.find("a.button[href^='http']").attr("href");
        const detail = card.find("a[href^='/sites/']").first();
        if (!url) return null;
        return {
          url,
          name: card.find("h3").first().text().trim() || null,
          industryHint: null,
          sourceRef: new URL(detail.attr("href"), BASE).href,
        };
      }).get(),
  });
}
