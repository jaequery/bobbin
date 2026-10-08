// Osmo showcase (osmo.supply/showcase), sites that members of Osmo, the
// resource library from Dennis Snellenberg and Ilja van Eck, built with it:
// mostly studio, portfolio and brand sites with heavy motion work (Filmbot,
// Paul Kalkbrenner, bunq). One page lists about 100 sites; each card carries
// the site link and its /showcase/<slug> page, so no detail page is fetched.
// robots.txt disallows the rest of the site but allows /showcase.
import * as cheerio from "cheerio";
import { fetchHtml } from "../http.js";

const BASE = "https://www.osmo.supply";

export const name = "osmo";

export async function* listing({ limit }) {
  const $ = cheerio.load(await fetchHtml(`${BASE}/showcase`));
  const cards = $(".showcase-card").map((_, card) => ({
    url: $(card).find("a[data-res-used='site-url']").attr("href"),
    name: $(card).find("[data-res-used='title']").first().text().trim() || null,
    ref: $(card).find("a.showcase-card__click").attr("href"),
  })).get().filter((c) => /^https?:\/\//.test(c.url || "") && /^\/showcase\/[\w-]+$/.test(c.ref || ""));
  if (!cards.length) console.warn(`[${name}] no entries on the showcase page; its markup may have changed`);
  for (const c of cards.slice(0, limit)) {
    yield { url: c.url, name: c.name, sourceRef: BASE + c.ref };
  }
}
