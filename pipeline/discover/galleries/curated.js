// Curated. Each card links to its /sites/s/<id>/ detail page and has an
// "Open" action to the site.
import { paged } from "./paged.js";

const BASE = "https://curated.design";

export const name = "curated";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => (n > 1 ? `${BASE}/sites/page/${n}/` : `${BASE}/`),
    parse: ($) =>
      $(".card-lift").map((_, el) => {
        const card = $(el);
        const url = card.find(".card-actions a[href^='http']").attr("href");
        const title = card.find("h3 a");
        if (!url || !title.attr("href")) return null;
        return { url, name: title.text().trim() || null, sourceRef: new URL(title.attr("href"), BASE).href };
      }).get(),
  });
}
