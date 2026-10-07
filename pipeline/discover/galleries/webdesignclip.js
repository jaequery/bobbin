// Web Design Clip (webdesignclip.com), a curated Japanese gallery. Each
// /page/<n>/ lists 48 sites, newest first; every card links to its detail post
// and out to the site, and names its category by an English slug.
import { paged } from "./paged.js";
import { industryFromTags } from "../industry.js";

const BASE = "https://webdesignclip.com";

// Category slugs that need rewording before industryFromTags can match them.
const SLUG_TAGS = { estate: "real estate", hospital: "medical", financial: "finance", design: "design agency", tv: "entertainment", movie: "film" };

export const name = "webdesignclip";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => `${BASE}/${n > 1 ? `page/${n}/` : ""}`,
    parse: ($) =>
      $("li.post_li").map((_, el) => {
        const card = $(el);
        const site = card.find(".post_title h2 a[href^='http']").first();
        const detail = card.find(".post_inner--detail a[href]").attr("href");
        if (!site.length || !detail) return null;
        const slug = card.find(".post_inner--category a[href*='/category/']").attr("href")?.match(/\/category\/([^/]+)/)?.[1];
        return {
          url: site.attr("href"),
          name: site.text().trim() || null,
          industryHint: slug ? industryFromTags(SLUG_TAGS[slug] ?? slug.replace(/-/g, " ")) : null,
          sourceRef: new URL(detail, BASE).href,
        };
      }).get(),
  });
}
