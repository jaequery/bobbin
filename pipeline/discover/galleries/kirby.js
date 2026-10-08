// Made with Kirby (madewith.getkirby.com), sites built with the Kirby CMS that
// its team picks, mostly European studio, culture and institution sites. Its
// RSS feed lists every site in one request: each item links straight out to
// the site, its guid is the site's /cases/<slug> page and its pubDate is when
// it was added, read newest first.
import * as cheerio from "cheerio";
import { fetchHtml } from "../http.js";

const FEED = "https://madewith.getkirby.com/feed.xml";

export const name = "kirby";

export async function* listing({ limit }) {
  const $ = cheerio.load(await fetchHtml(FEED), { xml: true });
  const entries = $("item").map((_, el) => {
    const item = $(el);
    return {
      url: item.children("link").text().trim(),
      name: item.children("title").text().trim() || null,
      sourceRef: item.children("guid").text().trim() || FEED,
      added: Date.parse(item.children("pubDate").text().trim()) || 0,
    };
  }).get().filter((e) => /^https?:\/\//.test(e.url));
  if (!entries.length) console.warn(`[${name}] no items in ${FEED}; its format may have changed`);
  entries.sort((a, b) => b.added - a.added);
  yield* entries.slice(0, limit).map(({ added, ...entry }) => entry);
}
