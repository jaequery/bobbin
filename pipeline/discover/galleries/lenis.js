// Lenis showcase (lenis.dev/showcase), sites built with the Lenis smooth-scroll
// library that its team (darkroom.engineering) picks, mostly studio and brand
// sites with heavy motion work. The listing renders client-side, but the
// sitemap lists every /showcase/<slug> page with a lastmod, read newest first;
// each page's title links out to the site. Partner promos (template shops,
// whose links carry an `atp` referral parameter, and a framer.link starter kit)
// are skipped. Pages already stored as a site's sourceRef are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";

const BASE = "https://lenis.dev";
const BATCH = 50;

const isPromo = (url) => {
  const u = new URL(url);
  return u.searchParams.has("atp") || u.hostname === "framer.link";
};

export const name = "lenis";

export async function* listing({ limit }) {
  const $map = cheerio.load(await fetchHtml(`${BASE}/sitemap.xml`), { xml: true });
  const refs = $map("url").map((_, el) => ({ ref: $map(el).find("loc").text().trim(), mod: $map(el).find("lastmod").text().trim() })).get()
    .filter(({ ref }) => ref.startsWith(`${BASE}/showcase/`))
    .sort((a, b) => b.mod.localeCompare(a.mod))
    .map(({ ref }) => ref);
  if (!refs.length) console.warn(`[${name}] no /showcase/ pages in the sitemap; its format may have changed`);
  let yielded = 0;
  for (let i = 0; i < refs.length && yielded < limit; i += BATCH) {
    const batch = refs.slice(i, i + BATCH);
    const known = await knownSourceRefs(batch);
    for (const ref of batch) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const $ = cheerio.load(await fetchHtml(ref));
      const link = $("a[href^='http']:has(h1)").first();
      const url = link.attr("href");
      if (!url || isPromo(url)) continue;
      yielded++;
      yield { url, name: link.find("h1").text().trim() || null, sourceRef: ref };
    }
  }
}
