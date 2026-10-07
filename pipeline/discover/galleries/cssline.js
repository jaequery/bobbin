// CSSline (cssline.com). Its home page and /sites/<n> list sites newest first,
// 20 a page; every card links to its /go/<slug> page and out to the site with a
// "Visit" link.
import { paged } from "./paged.js";

const BASE = "https://cssline.com";

export const name = "cssline";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    maxPages: 100,
    pageUrl: (n) => (n > 1 ? `${BASE}/sites/${n}` : `${BASE}/`),
    parse: ($) =>
      $("article:has(a.site-visit-link)").map((_, el) => {
        const card = $(el);
        const url = card.find("a.site-visit-link[href^='http']").attr("href");
        const detail = card.find(".site-title a[href^='/go/']").first();
        if (!url || !detail.length) return null;
        return { url, name: detail.text().trim() || null, sourceRef: new URL(detail.attr("href"), BASE).href };
      }).get(),
  });
}
