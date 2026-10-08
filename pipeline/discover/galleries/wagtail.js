// Made with Wagtail (madewithwagtail.org), about 620 production sites built with
// the Wagtail CMS that the Wagtail project reviews before listing, mostly
// nonprofits, universities, museums, governments and studios. It lists them
// newest first, paged with /page/<n>, about 12 a page; every card links
// straight out to the site, and its /developers/<agency>/<slug>/ info page is
// kept as the source, so no page per site is fetched.
import { paged } from "./paged.js";

const BASE = "https://madewithwagtail.org";

export const name = "wagtail";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    maxPages: 80,
    pageUrl: (n) => `${BASE}/${n > 1 ? `page/${n}` : ""}`,
    parse: ($, pageUrl) =>
      $(".site-listing a.project__visit[href^='http']").map((_, el) => {
        const card = $(el).closest(".card").parent();
        const info = card.find("a.project__info").attr("href");
        return {
          url: $(el).attr("href"),
          name: card.find(".project-title").first().text().trim() || null,
          sourceRef: info ? new URL(info, BASE).href : pageUrl,
        };
      }).get(),
  });
}
