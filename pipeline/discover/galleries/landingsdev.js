// Landings (landings.dev), a gallery of SaaS and developer-tool landing pages.
// Its sitemap lists every /post/<slug> page, some twice, appended oldest first,
// so entries are deduplicated and read newest lastmod first. Each page links out
// to the site with a ?ref=landings.dev link; every site is tagged SaaS. Pages
// already stored as a site's sourceRef are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";

const BASE = "https://landings.dev";
const BATCH = 50;

export const name = "landingsdev";

export async function* listing({ limit }) {
  const $map = cheerio.load(await fetchHtml(`${BASE}/sitemap.xml`), { xml: true });
  const latest = new Map();
  $map("url").each((_, el) => {
    const ref = $map(el).find("loc").text().trim();
    if (!ref.startsWith(`${BASE}/post/`)) return;
    const mod = $map(el).find("lastmod").text().trim();
    if (!latest.has(ref) || mod > latest.get(ref)) latest.set(ref, mod);
  });
  const refs = [...latest].sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0)).map(([ref]) => ref);
  if (!refs.length) console.warn(`[${name}] no /post/ pages in the sitemap; its format may have changed`);
  let yielded = 0;
  for (let i = 0; i < refs.length && yielded < limit; i += BATCH) {
    const batch = refs.slice(i, i + BATCH);
    const known = await knownSourceRefs(batch);
    for (const ref of batch) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const $ = cheerio.load(await fetchHtml(ref));
      const url = $("a[href^='http'][href*='ref=landings.dev']").first().attr("href");
      if (!url) continue;
      const title = $("meta[property='og:title']").attr("content") || "";
      yielded++;
      yield { url, name: title.replace(/\s*Landing Page Design\s*$/i, "").trim() || null, industryHint: "SaaS", sourceRef: ref };
    }
  }
}
