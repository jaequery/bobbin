// Made with Wagtail (madewithwagtail.org), sites built with the Wagtail CMS
// that its maintainers list, from governments, universities and museums to
// studios and nonprofits, about 640 in all. Its home page lists them 12 a page,
// paged with /page/<n>/; each card links straight out to the site and to its
// /developers/<studio>/<site>/ page, which is the source.
import { paged } from "./paged.js";

const BASE = "https://madewithwagtail.org";

export const name = "wagtail";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    maxPages: 80,
    pageUrl: (n) => `${BASE}/${n > 1 ? `page/${n}/` : ""}`,
    parse: ($) =>
      $(".site-listing .card").map((_, el) => {
        const card = $(el);
        const url = card.find("a.project__visit[href^='http']").attr("href");
        const ref = card.find("a.project__info").attr("href");
        if (!url) return null;
        return {
          url,
          name: card.parent().find(".project-title").first().text().trim() || null,
          sourceRef: ref ? BASE + ref : BASE,
        };
      }).get(),
  });
}
