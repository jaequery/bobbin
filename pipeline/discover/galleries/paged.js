// Shared paging loop for gallery adapters: fetches page 1, 2, … and yields the
// entries `parse` extracts, until `limit` entries or an empty page.
import * as cheerio from "cheerio";
import { fetchHtml } from "../http.js";

export async function* paged({ name, pageUrl, parse, limit, maxPages = 50 }) {
  let yielded = 0;
  for (let page = 1; page <= maxPages && yielded < limit; page++) {
    const url = pageUrl(page);
    const entries = parse(cheerio.load(await fetchHtml(url)), url);
    if (!entries.length) {
      if (page === 1) console.warn(`[${name}] no entries on ${url}; the gallery markup may have changed`);
      return;
    }
    for (const entry of entries) {
      if (yielded >= limit) return;
      yielded++;
      yield entry;
    }
  }
}
