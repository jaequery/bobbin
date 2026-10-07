// Navbar Gallery (navbar.gallery), a gallery of website navigation bars. Each
// ?d25fafcb_page=<n> listing item has a "Visit Website" link and links to its
// /navbar/<slug> page; its screenshot's alt text names the site.
import { paged } from "./paged.js";

const BASE = "https://www.navbar.gallery";

export const name = "navbargallery";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => `${BASE}/${n > 1 ? `?d25fafcb_page=${n}` : ""}`,
    parse: ($) =>
      $("[fs-cmsload-element='list'] > [role='listitem']").map((_, el) => {
        const card = $(el);
        const url = card.find("a[aria-label='Visit Website'][href^='http']").attr("href");
        const detail = card.find("a[href^='/navbar/']").attr("href");
        if (!url || !detail) return null;
        const name = card.find("img[src*='cdn.navbar.gallery']").first().attr("alt")?.trim();
        return { url, name: name || null, sourceRef: new URL(detail, BASE).href };
      }).get(),
  });
}
