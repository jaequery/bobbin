// Landingfolio (landingfolio.com). Its landing-page gallery loads 80 posts per
// page, newest first, from the JSON API behind the site (the same call its
// "Load more" button makes); each post has the site URL, title and categories.
import { fetchJson } from "../http.js";
import { industryFromTags } from "../industry.js";

const BASE = "https://www.landingfolio.com";
const API = "https://landingfolio-2026.onrender.com";
const MAX_PAGES = 50;

export const name = "landingfolio";

export async function* listing({ limit }) {
  let yielded = 0;
  for (let page = 1; page <= MAX_PAGES && yielded < limit; page++) {
    const posts = await fetchJson(`${API}/inspiration?category=landing-page&page=${page}`);
    if (!Array.isArray(posts) || !posts.length) {
      if (page === 1) console.warn(`[${name}] no posts from ${API}/inspiration; its API may have changed`);
      return;
    }
    for (const p of posts) {
      if (yielded >= limit) return;
      if (!p?.slug || !/^https?:\/\//.test(p.url || "")) continue;
      yielded++;
      yield {
        url: p.url,
        name: p.title?.trim() || null,
        industryHint: industryFromTags((p.categories ?? []).map((c) => String(c).replace(/-/g, " "))),
        sourceRef: `${BASE}/inspiration/post/${p.slug}`,
      };
    }
  }
}
