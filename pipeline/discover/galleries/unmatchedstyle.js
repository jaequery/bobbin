// Unmatched Style (unmatchedstyle.com). Its gallery is the "gallery" category of
// its WordPress posts, read newest first from the WordPress REST API (the gallery
// page itself loads cards client-side). Each post page links out to the site
// with a "Visit Site" button; posts already stored as a site's sourceRef are not
// fetched again. The post's other categories are mapped to an industry.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml, fetchJson } from "../http.js";
import { industryFromTags } from "../industry.js";

const API = "https://unmatchedstyle.com/wp-json/wp/v2";
const PER_PAGE = 100;
const MAX_PAGES = 70;

// Category slugs that need rewording before industryFromTags can match them.
const SLUG_TAGS = {
  "design-firm": "design agency", "marketing-company": "agency", "food-bev": "food",
  "shopping": "shop", "software-gallery": "software", "real-estate-gallery": "real estate",
  "financial": "finance", "sports-recreation": "fitness", "gaming": "games",
};

export const name = "unmatchedstyle";

export async function* listing({ limit }) {
  const cats = await fetchJson(`${API}/categories?per_page=100&_fields=id,slug`);
  const slugs = new Map(cats.map((c) => [c.id, c.slug]));
  const gallery = cats.find((c) => c.slug === "gallery")?.id;
  if (!gallery) {
    console.warn(`[${name}] no gallery category in ${API}/categories; the site may have changed`);
    return;
  }
  let yielded = 0;
  for (let page = 1; page <= MAX_PAGES && yielded < limit; page++) {
    const posts = await fetchJson(`${API}/posts?categories=${gallery}&per_page=${PER_PAGE}&page=${page}&_fields=link,title,categories`);
    if (!Array.isArray(posts) || !posts.length) {
      if (page === 1) console.warn(`[${name}] no gallery posts from ${API}/posts; its API may have changed`);
      return;
    }
    const known = await knownSourceRefs(posts.map((p) => p.link));
    for (const p of posts) {
      if (yielded >= limit) return;
      if (!p?.link || known.has(p.link)) continue;
      const $ = cheerio.load(await fetchHtml(p.link));
      const url = $("a.ums-post__visit[href^='http']").first().attr("href");
      if (!url) continue;
      const tags = (p.categories ?? []).map((id) => slugs.get(id)).filter((s) => s && s !== "gallery");
      yielded++;
      yield {
        url,
        name: cheerio.load(p.title?.rendered ?? "").text().trim() || null,
        industryHint: industryFromTags(tags.map((s) => SLUG_TAGS[s] ?? s.replace(/-/g, " "))),
        sourceRef: p.link,
      };
    }
  }
}
