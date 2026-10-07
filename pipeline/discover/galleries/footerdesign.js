// Footer.design, a gallery of website footers. Each ?23ac8823_page=<n> listing
// card links to its /sites/<slug> page and has a "Visit website" link.
import { paged } from "./paged.js";

const BASE = "https://www.footer.design";

export const name = "footerdesign";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => `${BASE}/${n > 1 ? `?23ac8823_page=${n}` : ""}`,
    parse: ($) =>
      $(".gallery_item").map((_, el) => {
        const card = $(el);
        const url = card.find("a.button[target='_blank'][href^='http']").attr("href");
        const detail = card.find("a.gallery_item-left[href^='/sites/']");
        if (!url || !detail.length) return null;
        return { url, name: detail.find("h3").text().trim() || null, sourceRef: new URL(detail.attr("href"), BASE).href };
      }).get(),
  });
}
