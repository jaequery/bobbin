// Brutalist Websites (brutalistwebsites.com). One page lists every site,
// newest first; each box's screenshot links to the site and its caption names
// it. Boxes linking back into the gallery (its own magazine) are skipped.
import * as cheerio from "cheerio";
import { fetchHtml } from "../http.js";

const BASE = "https://brutalistwebsites.com";

export const name = "brutalistwebsites";

export async function* listing({ limit }) {
  const $ = cheerio.load(await fetchHtml(`${BASE}/`));
  const entries = $(".box").map((_, el) => {
    const box = $(el);
    const url = box.find(".screenshot a[href^='http']").attr("href");
    if (!url || new URL(url).hostname.replace(/^www\./, "") === "brutalistwebsites.com") return null;
    const caption = box.find("p").first();
    const interview = caption.find("a[href*='brutalistwebsites.com/']").attr("href");
    caption.find("a").remove();
    return { url, name: caption.text().replace(/\s+/g, " ").trim() || null, sourceRef: interview || `${BASE}/` };
  }).get();
  if (!entries.length) console.warn(`[${name}] no entries on ${BASE}/; the gallery markup may have changed`);
  yield* entries.slice(0, limit);
}
