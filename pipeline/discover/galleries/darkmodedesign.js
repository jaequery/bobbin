// Dark Mode Design. A Webflow collection whose cards link straight to the site;
// there is no detail page, so the listing page is the reference. The page
// parameter is named after the collection's id.
import { paged } from "./paged.js";

export const name = "darkmodedesign";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => `https://darkmodedesign.com/${n > 1 ? `?60a99e98_page=${n}` : ""}`,
    parse: ($, pageUrl) =>
      $(".collectionitem a.screenshot[href^='http']").map((_, el) => {
        const card = $(el);
        return { url: card.attr("href"), name: card.find(".p2").text().trim() || null, sourceRef: pageUrl };
      }).get(),
  });
}
