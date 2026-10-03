// One Page Love inspiration. Cards carry the outbound link and a genre.
import { paged } from "./paged.js";
import { industryFromTags } from "../industry.js";

export const name = "onepagelove";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => `https://onepagelove.com/inspiration${n > 1 ? `/page/${n}` : ""}`,
    parse: ($) =>
      $(".thumb-inspiration").map((_, el) => {
        const card = $(el);
        const url = card.find(".thumb-link a[href^='http']").attr("href");
        const title = card.find(".thumb-name a").first();
        if (!url || !title.attr("href")) return null;
        const genres = card.find(".thumb-category a").map((_, a) => $(a).text().trim()).get();
        return {
          url,
          name: title.text().trim() || null,
          industryHint: industryFromTags(genres),
          sourceRef: title.attr("href"),
        };
      }).get(),
  });
}
