// Typ.io, a gallery of web typography samples from real sites. Its /samples
// listing shows 10 samples a page, newest first, paged with ?page=<n>; each
// sample links to its /s/<slug> page and out to the site (often a deep page,
// which normalization reduces to the domain). Tags map to an industry.
import { paged } from "./paged.js";
import { industryFromTags } from "../industry.js";

const BASE = "https://typ.io";

export const name = "typio";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => (n > 1 ? `${BASE}/samples?page=${n}` : `${BASE}/samples`),
    parse: ($) =>
      $("article.sample").map((_, el) => {
        const card = $(el);
        const url = card.find(".sample__meta dt:contains('Site') + dd a[href^='http']").attr("href");
        const detail = card.find("a.sample__image[href^='/s/']").attr("href");
        if (!url || !detail) return null;
        const tags = card.find(".sample__meta--tags a").map((_, a) => $(a).text().trim().replace(/_/g, " ")).get();
        return { url, name: null, industryHint: industryFromTags(tags), sourceRef: new URL(detail, BASE).href };
      }).get(),
  });
}
