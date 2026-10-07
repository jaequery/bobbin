// Pricing Pages (pricingpages.design), a gallery of SaaS pricing pages. Its home
// page lists them 24 a page, paged with Webflow's ?23ac8823_page=<n>;
// every card links to its /sites/<slug> page and out to the pricing page with a
// "Visit site" button. Discovery keeps only the domain; every site is tagged SaaS.
import { paged } from "./paged.js";

const BASE = "https://pricingpages.design";

export const name = "pricingpages";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    maxPages: 30,
    pageUrl: (n) => (n > 1 ? `${BASE}/?23ac8823_page=${n}` : `${BASE}/`),
    parse: ($) =>
      $(".gallery_item:has(a[href^='/sites/'])").map((_, el) => {
        const card = $(el);
        const url = card.find("a.button[href^='http']").attr("href");
        const detail = card.find("a[href^='/sites/']").first();
        if (!url) return null;
        return {
          url,
          name: card.find("h3").first().text().trim() || null,
          industryHint: "SaaS",
          sourceRef: new URL(detail.attr("href"), BASE).href,
        };
      }).get(),
  });
}
