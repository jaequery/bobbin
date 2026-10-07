// Design Nominees (designnominees.com). Each /winners-websites/page/<n> lists
// 12 Sites of the Day, newest first; every card links to its /sites/<slug>
// page and out to the site.
import { paged } from "./paged.js";

const BASE = "https://www.designnominees.com";

export const name = "designnominees";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => `${BASE}/winners-websites${n > 1 ? `/page/${n}` : ""}`,
    parse: ($) =>
      $("li:has(> .sites-img)").map((_, el) => {
        const card = $(el);
        const url = card.find(".site-link a[target='_blank'][href^='http']").attr("href");
        const detail = card.find(".sites-info h2 a[href*='/sites/']").first();
        if (!url || !detail.length) return null;
        return { url, name: detail.text().trim() || null, sourceRef: new URL(detail.attr("href"), BASE).href };
      }).get(),
  });
}
