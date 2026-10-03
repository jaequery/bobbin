// Httpster. Each preview has a detail link and a "Visit" link to the site.
import { paged } from "./paged.js";

const BASE = "https://httpster.net";

export const name = "httpster";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => `${BASE}/${n > 1 ? `page/${n}/` : ""}`,
    parse: ($) =>
      $(".Preview").map((_, el) => {
        const card = $(el);
        const url = card.find("a.Preview__ext[href^='http']").attr("href");
        const title = card.find("a.Preview__title");
        if (!url || !title.attr("href")) return null; // sponsored cards have no detail page
        return { url, name: title.text().trim() || null, sourceRef: new URL(title.attr("href"), BASE).href };
      }).get(),
  });
}
