// CSS Nectar gallery. Each post title links to its detail page, with an
// external-link icon to the site beside it.
import { paged } from "./paged.js";

export const name = "cssnectar";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => `https://cssnectar.com/${n > 1 ? `page/${n}/` : ""}`,
    parse: ($) =>
      $("h2.fl-post-title").map((_, el) => {
        const heading = $(el);
        const url = heading.find("a.site_link_icon[href^='http']").attr("href");
        const title = heading.find("a").first();
        if (!url || !title.attr("href")) return null;
        return { url, name: title.text().trim() || null, sourceRef: title.attr("href") };
      }).get(),
  });
}
