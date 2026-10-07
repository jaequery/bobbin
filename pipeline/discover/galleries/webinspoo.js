// Webinspoo, a gallery of SaaS sites and their pages. Its listings ignore
// paging, so its sitemap is read instead, newest lastmod first. A site has one
// /inspiration/<slug> page per captured page (pricing, blog, …); only the
// <name>-landing-page entries are kept, one per site. Each links out to the site
// with ?ref=webinspoo. Every site is tagged SaaS. Pages already stored as a
// site's sourceRef are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";

const BASE = "https://webinspoo.com";
const BATCH = 50;

export const name = "webinspoo";

export async function* listing({ limit }) {
  const $map = cheerio.load(await fetchHtml(`${BASE}/sitemap.xml`), { xml: true });
  const entries = $map("url").map((_, el) => ({
    ref: $map(el).find("loc").text().trim(),
    mod: $map(el).find("lastmod").text().trim(),
  })).get().filter(({ ref }) => /^https:\/\/webinspoo\.com\/inspiration\/[^/]+-landing-page$/.test(ref));
  const refs = [...new Set(entries.sort((a, b) => (a.mod < b.mod ? 1 : a.mod > b.mod ? -1 : 0)).map((e) => e.ref))];
  if (!refs.length) console.warn(`[${name}] no landing pages in the sitemap; its format may have changed`);
  let yielded = 0;
  for (let i = 0; i < refs.length && yielded < limit; i += BATCH) {
    const batch = refs.slice(i, i + BATCH);
    const known = await knownSourceRefs(batch);
    for (const ref of batch) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const $ = cheerio.load(await fetchHtml(ref));
      const url = $("a.hover\\:underline[href^='http'][href*='ref=webinspoo']").first().attr("href");
      if (!url) continue;
      yielded++;
      yield { url, name: $("h1").first().text().replace(/\s*—\s*Landing Page\s*$/i, "").trim() || null, industryHint: "SaaS", sourceRef: ref };
    }
  }
}
