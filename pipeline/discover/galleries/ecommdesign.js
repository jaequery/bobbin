// ecomm.design, a gallery of online stores. Each ?fwp_paged=<n> listing card
// links to its /site/<slug>/ page and out to the store.
import { paged } from "./paged.js";

const BASE = "https://ecomm.design";

export const name = "ecommdesign";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => `${BASE}/${n > 1 ? `?fwp_paged=${n}` : ""}`,
    parse: ($) =>
      $(".card-website").map((_, el) => {
        const card = $(el);
        const url = card.find("a.site-link[href^='http']").attr("href");
        const detail = card.find(".website-meta-left a[href^='https://ecomm.design/site/']").first();
        if (!url || !detail.length) return null;
        return { url, name: detail.text().trim() || null, industryHint: "E-commerce", sourceRef: detail.attr("href") };
      }).get(),
  });
}
