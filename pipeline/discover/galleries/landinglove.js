// Landing Love (landing.love). Each /sites/page/<n>/ card links to its
// /sites/<slug>/ detail page, lists categories and has a Visit link to the site.
import { paged } from "./paged.js";
import { industryFromTags } from "../industry.js";

const BASE = "https://www.landing.love";

export const name = "landinglove";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => `${BASE}/sites/${n > 1 ? `page/${n}/` : ""}`,
    parse: ($) =>
      $("a[title^='Visit '][title$=' Website'][href^='http']").map((_, el) => {
        const visit = $(el);
        const card = visit.parent();
        const title = card.find("a.text-lg[href^='/sites/']").first();
        if (!title.length) return null;
        const categories = card.find("a[href^='/categories/']").map((_, a) => $(a).text().trim()).get();
        return {
          url: visit.attr("href"),
          name: title.text().trim() || null,
          industryHint: industryFromTags(categories),
          sourceRef: new URL(title.attr("href"), BASE).href,
        };
      }).get(),
  });
}
