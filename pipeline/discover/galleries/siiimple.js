// Siiimple (siiimple.com), a gallery of minimal sites. Each /page/<n>/ listing
// card has a Details link and a Visit link to the site.
import { paged } from "./paged.js";

const BASE = "https://siiimple.com";

export const name = "siiimple";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => (n > 1 ? `${BASE}/page/${n}/` : `${BASE}/`),
    parse: ($) =>
      $(".gallery-cover").map((_, el) => {
        const card = $(el);
        const url = card.find(".visit-link a[href^='http']").attr("href");
        const detail = card.find(".gallery-meta a[href^='https://siiimple.com/']").attr("href");
        if (!url || !detail) return null;
        return { url, name: card.find("img").attr("alt")?.trim() || null, sourceRef: detail };
      }).get(),
  });
}
