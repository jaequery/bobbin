// Wall of Portfolios, a gallery of designer portfolio sites. Its listings
// load client-side, so its sitemap is read instead, newest lastmod first. Each
// /portfolios/<slug>/ page names the site in its ProfilePage JSON-LD
// (mainEntity.url). Every site is tagged Agency & Portfolio. Pages already
// stored as a site's sourceRef are not fetched again.
import * as cheerio from "cheerio";
import { knownSourceRefs } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";

const BASE = "https://www.wallofportfolios.in";
const BATCH = 50;

export const name = "wallofportfolios";

function profile($) {
  for (const el of $("script[type='application/ld+json']").toArray()) {
    try {
      const data = JSON.parse($(el).text());
      if (data?.["@type"] === "ProfilePage" && data.mainEntity) return data.mainEntity;
    } catch {}
  }
  return null;
}

export async function* listing({ limit }) {
  const $map = cheerio.load(await fetchHtml(`${BASE}/sitemap.xml`), { xml: true });
  const entries = $map("url").map((_, el) => ({
    ref: $map(el).find("loc").text().trim(),
    mod: $map(el).find("lastmod").text().trim(),
  })).get().filter(({ ref }) => /^https:\/\/www\.wallofportfolios\.in\/portfolios\/[^/]+\/$/.test(ref));
  const refs = [...new Set(entries.sort((a, b) => (a.mod < b.mod ? 1 : a.mod > b.mod ? -1 : 0)).map((e) => e.ref))];
  if (!refs.length) console.warn(`[${name}] no portfolios in the sitemap; its format may have changed`);
  let yielded = 0;
  for (let i = 0; i < refs.length && yielded < limit; i += BATCH) {
    const batch = refs.slice(i, i + BATCH);
    const known = await knownSourceRefs(batch);
    for (const ref of batch) {
      if (yielded >= limit) return;
      if (known.has(ref)) continue;
      const person = profile(cheerio.load(await fetchHtml(ref)));
      const url = typeof person?.url === "string" && /^https?:\/\//.test(person.url) ? person.url : null;
      if (!url) continue;
      yielded++;
      yield { url, name: person.name?.trim() || null, industryHint: "Agency & Portfolio", sourceRef: ref };
    }
  }
}
