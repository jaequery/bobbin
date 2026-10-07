// CSS Design Awards website gallery. Each thumbnail links out to the site and
// to its /sites/<slug>/<id>/ detail page.
import { paged } from "./paged.js";

const BASE = "https://www.cssdesignawards.com";

export const name = "cssdesignawards";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => `${BASE}/website-gallery${n > 1 ? `?page=${n}` : ""}`,
    parse: ($) =>
      $(".single-project__thumbnail").map((_, el) => {
        const thumb = $(el);
        const url = thumb.find("a.sp__project-link[href^='http']").attr("href");
        const title = thumb.parent().find(".single-project__title a");
        if (!url || !title.attr("href")) return null;
        return { url, name: title.text().trim() || null, sourceRef: new URL(title.attr("href"), BASE).href };
      }).get(),
  });
}
