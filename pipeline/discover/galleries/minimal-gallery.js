// Minimal Gallery websites. Each post has a detail link and a "Visit website" button.
import { paged } from "./paged.js";

export const name = "minimal-gallery";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => `https://minimal.gallery/websites/${n > 1 ? `page/${n}/` : ""}`,
    parse: ($) =>
      $(".post.website").map((_, el) => {
        const card = $(el);
        const url = card.find("a.site-button[href^='http']").attr("href");
        const title = card.find(".text h3 a");
        if (!url || !title.attr("href")) return null;
        return { url, name: title.text().trim() || null, sourceRef: title.attr("href") };
      }).get(),
  });
}
