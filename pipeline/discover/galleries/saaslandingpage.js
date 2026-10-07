// SaaS Landing Page (saaslandingpage.com). Its home page lists landing pages
// newest first and pages by /page/<n>/; every card links out to the site with a
// "Visit Website" button and to its detail page, and carries the post's tags as
// tag-<slug> classes. Tags are mapped to an industry, falling back to SaaS.
import { paged } from "./paged.js";
import { industryFromTags } from "../industry.js";

const BASE = "https://saaslandingpage.com";

export const name = "saaslandingpage";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    maxPages: 100,
    pageUrl: (n) => (n > 1 ? `${BASE}/page/${n}/` : `${BASE}/`),
    parse: ($) =>
      $("article.post").map((_, el) => {
        const card = $(el);
        const url = card.find("a[title='Visit Website'][href^='http']").attr("href");
        const detail = card.find("h2 a[href]").first();
        if (!url || !detail.length) return null;
        const tags = (card.attr("class") || "").split(/\s+/).filter((c) => c.startsWith("tag-")).map((c) => c.slice(4).replace(/-/g, " "));
        return { url, name: detail.text().trim() || null, industryHint: industryFromTags(tags) ?? "SaaS", sourceRef: detail.attr("href") };
      }).get(),
  });
}
