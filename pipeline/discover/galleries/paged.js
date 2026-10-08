// Shared paging loop for gallery adapters: fetches page 1 for new entries, then
// resumes at the page an earlier run reached (gallery_cursors) and reads on,
// yielding the entries `parse` extracts until `limit` entries, an empty page or
// `maxPages`. Entries whose site or detail page is already stored are skipped,
// so they use up none of a run's reads and each run reaches further back.
import * as cheerio from "cheerio";
import { galleryCursor, knownDomains, knownSourceRefs, setGalleryCursor } from "../../../lib/db.js";
import { fetchHtml } from "../http.js";
import { candidateDomain } from "../normalize.js";

// The entries on a page that no stored site matches by domain or by detail page.
// Adapters without detail pages use the listing page as every entry's sourceRef,
// so that one says nothing about a single entry.
async function unseen(entries, pageUrl) {
  const domains = entries.map((e) => candidateDomain(e.url));
  const refs = entries.map((e) => (e.sourceRef && e.sourceRef !== pageUrl ? e.sourceRef : null));
  const [knownDoms, knownRefs] = await Promise.all([
    knownDomains(domains.filter(Boolean)),
    knownSourceRefs(refs.filter(Boolean)),
  ]);
  return entries.filter((_, i) => !knownDoms.has(domains[i]) && !knownRefs.has(refs[i]));
}

export async function* paged({ name, pageUrl, parse, limit, maxPages = 1000 }) {
  // Without the gallery_cursors table (003 not migrated yet) every run starts at page 2.
  const cursor = await galleryCursor(name).catch((err) => {
    console.warn(`[${name}] no paging cursor, reading from the start: ${err.message}`);
    return undefined;
  });
  let yielded = 0;
  let previous = null;
  for (let page = 1; page <= maxPages && yielded < limit; page = page === 1 ? Math.max(2, cursor ?? 2) : page + 1) {
    const url = pageUrl(page);
    const entries = parse(cheerio.load(await fetchHtml(url)), url);
    if (!entries.length) {
      if (page === 1) console.warn(`[${name}] no entries on ${url}; the gallery markup may have changed`);
      return;
    }
    // A gallery that ignores the page parameter serves the same entries again.
    const key = entries.map((e) => e.url).join("\n");
    if (key === previous) return;
    previous = key;
    if (page > 1 && cursor !== undefined && page !== cursor) await setGalleryCursor(name, page);
    for (const entry of await unseen(entries, url)) {
      if (yielded >= limit) return;
      yielded++;
      yield entry;
    }
  }
}
