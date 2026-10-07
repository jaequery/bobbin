// Best Website Gallery (bestwebsite.gallery). Each /sites/<n> listing row has a
// details link to its /sites/sotd/... page and an external link to the site.
import { paged } from "./paged.js";

const BASE = "https://bestwebsite.gallery";

export const name = "bestwebsitegallery";

export function listing({ limit }) {
  return paged({
    name,
    limit,
    pageUrl: (n) => `${BASE}/sites${n > 1 ? `/${n}` : ""}`,
    parse: ($) =>
      $("li[data-slot='site-row']").map((_, el) => {
        const row = $(el);
        const external = row.find("a[data-cabin-event='click: view website (external)'][href^='http']").first();
        const detail = row.find("a[href^='/sites/sotd/']").first().attr("href");
        if (!external.length || !detail) return null;
        const label = external.attr("aria-label")?.match(/^Open (.+) externally$/)?.[1];
        return { url: external.attr("href"), name: label?.trim() || null, sourceRef: new URL(detail, BASE).href };
      }).get(),
  });
}
