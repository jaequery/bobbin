// Refero Styles (styles.refero.design): the design systems of sites Refero
// curates. The sitemap lists every /style/<id> page, and each page links out
// to its site. Pages already stored as a site's sourceRef are not fetched again,
// so each run reaches further into the list.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";

const BASE = "https://styles.refero.design";
const BATCH = 50;

export const name = "refero";

export async function* listing({ limit }) {
  const $map = cheerio.load(await fetchHtml(`${BASE}/sitemaps/styles.xml`), { xml: true });
  const refs = $map("url > loc").map((_, el) => $map(el).text().trim()).get().filter((u) => u.startsWith(`${BASE}/style/`));
  if (!refs.length) console.warn(`[${name}] no style pages in the sitemap; its format may have changed`);
  let yielded = 0;
  for (let i = 0; i < refs.length && yielded < limit; i += BATCH) {
    const batch = refs.slice(i, i + BATCH);
    const known = await knownSourceRefs(batch);
    for (const ref of batch) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const $ = cheerio.load(await fetchHtml(ref));
      const url = $("a[target='_blank'][href^='http']")
        .map((_, a) => $(a).attr("href")).get()
        .find((href) => !new URL(href).hostname.endsWith("refero.design"));
      if (!url) continue;
      yielded++;
      yield { url, name: $("h1").first().text().trim() || null, sourceRef: ref };
    }
  }
}
