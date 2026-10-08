// MUUUUU.ORG (muuuuu.org), a large curated Japanese web design gallery. Each
// /page/<n> lists its sites newest first; every card links out to the site and
// to its detail post, whose path names the industry (/industry/<slug>/) when it
// is filed under one.
import { paged } from "./paged.js";
import { industryFromTags } from "../industry.js";

const BASE = "https://muuuuu.org";

// Industry slugs that need rewording before industryFromTags can match them.
const SLUG_TAGS = {
  building: "architecture", hospital: "medical", "welfare-care": "health", "education-service": "education",
  technology: "tech", trip: "travel", car: "automotive", shopping: "shop", publication: "publishing",
  ad: "agency", fashionall: "fashion", watch: "jewelry", "science-research": "tech",
};

export const name = "muuuuu";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    maxPages: 80,
    pageUrl: (n) => `${BASE}/${n > 1 ? `page/${n}` : ""}`,
    parse: ($) =>
      $("li.c-post-list__item").map((_, el) => {
        const card = $(el);
        const url = card.find("a.c-post-list__link[href^='http']").attr("href");
        const detail = card.find("a.c-post-list__title-link[href]").attr("href");
        if (!url || !detail) return null;
        const slug = detail.match(/\/industry\/([^/]+)\//)?.[1];
        return {
          url,
          name: card.find(".c-post-list__ttl").text().trim() || null,
          industryHint: slug ? industryFromTags(SLUG_TAGS[slug] ?? slug.replace(/-/g, " ")) : null,
          sourceRef: new URL(detail, BASE).href,
        };
      }).get(),
  });
}
