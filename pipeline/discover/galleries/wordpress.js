// WordPress Showcase (wordpress.org/showcase), sites built with WordPress that
// its team picks, from museums and newsrooms to large brands (NASA, Noma, the
// Noguchi Museum, Rolling Stone, ...). Its posts are read newest first from the
// WordPress REST API, two requests for the whole gallery: each post's `domain`
// field names the site, so no post page is fetched. Archived entries carry no
// domain and are skipped. The category and tag slugs in each post's class list
// are mapped to an industry, minus `technology`, which the gallery puts on
// newsrooms, museums and game studios alike.
import * as cheerio from "cheerio";
import { fetchJson } from "../http.js";
import { industryFromTags } from "../industry.js";

const API = "https://wordpress.org/showcase/wp-json/wp/v2/posts";
const PER_PAGE = 100;
const MAX_PAGES = 10;
const IGNORED = new Set(["technology", "featured", "general"]);

export const name = "wordpress";

export async function* listing({ limit }) {
  let yielded = 0;
  for (let page = 1; page <= MAX_PAGES && yielded < limit; page++) {
    const posts = await fetchJson(`${API}?per_page=${PER_PAGE}&page=${page}&_fields=link,title,meta.domain,class_list`);
    if (!Array.isArray(posts) || !posts.length) {
      if (page === 1) console.warn(`[${name}] no posts from ${API}; its API may have changed`);
      return;
    }
    for (const p of posts) {
      if (yielded >= limit) return;
      const domain = p?.meta?.domain?.trim();
      if (!domain) continue;
      const tags = (p.class_list ?? []).map((c) => c.match(/^(?:category|tag)-(.+)$/)?.[1]).filter((s) => s && !IGNORED.has(s));
      yielded++;
      yield {
        url: /^https?:\/\//i.test(domain) ? domain : `https://${domain}`,
        name: cheerio.load(p.title?.rendered ?? "").text().trim() || null,
        industryHint: industryFromTags(tags.map((s) => s.replace(/-/g, " "))),
        sourceRef: p.link,
      };
    }
    if (posts.length < PER_PAGE) return;
  }
}
