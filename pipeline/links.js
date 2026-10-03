// Picks a site's interesting internal pages (pricing, login, about...) from the
// links on its home page.
import { getDomain } from "tldts";

// Ordered by how much we want each one. `pattern` is a PAGE_PATTERNS value
// (lib/taxonomy.js) stored as a hint on the page; the AI judge may overwrite it.
const PAGE_TYPES = [
  { pattern: "Pricing", re: /\b(pricing|prices|plans?|tarif[es]*|preise|precios)\b/ },
  { pattern: "Sign up", re: /\b(sign[-_ ]?up|register|get[-_ ]?started|start[-_ ]?free|join|create[-_ ]?account|try[-_ ]?(it[-_ ]?)?free)\b/ },
  { pattern: "Log in", re: /\b(log[-_ ]?in|sign[-_ ]?in|signin|login|account)\b/ },
  { pattern: "About", re: /\b(about([-_ ]?us)?|company|our[-_ ]?story|team|uber[-_ ]?uns|qui[-_ ]?sommes)\b/ },
  { pattern: "Features", re: /\b(features?|product|platform|solutions?|how[-_ ]?it[-_ ]?works|services?|work|projects?|portfolio)\b/ },
  { pattern: "Blog", re: /\b(blog|journal|news|stories|insights|articles?)\b/ },
  { pattern: "Careers", re: /\b(careers?|jobs|hiring|join[-_ ]?us)\b/ },
  { pattern: "Contact", re: /\b(contact([-_ ]?us)?|support|help|kontakt)\b/ },
  { pattern: "Docs", re: /\b(docs|documentation|developers?|api|guides?)\b/ },
  { pattern: "Changelog", re: /\b(changelog|releases?|what'?s[-_ ]?new|updates)\b/ },
];

const FILE_EXT = /\.(pdf|zip|png|jpe?g|gif|svg|webp|mp4|mov|mp3|xml|json|txt|csv|dmg|exe|pkg|ics|rss)$/i;

export function registrableDomain(hostname) {
  return getDomain(hostname) || hostname.replace(/^www\./, "");
}

// Collects every <a href> with its visible text.
export function collectLinks(page) {
  return page.$$eval("a[href]", (as) => as.map((a) => ({
    href: a.href,
    text: (a.innerText || a.getAttribute("aria-label") || a.title || "").trim().replace(/\s+/g, " ").slice(0, 80),
  })));
}

// Returns up to `max` [{ url, path, pattern }], one per page type, best first.
export function pickSubpages(links, homeUrl, max = 8) {
  const home = new URL(homeUrl);
  const site = registrableDomain(home.hostname);
  const byPath = new Map();

  for (const { href, text } of links) {
    let u;
    try { u = new URL(href, home); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    if (registrableDomain(u.hostname) !== site) continue;
    if (FILE_EXT.test(u.pathname)) continue;
    // Only the site's own host (or its www twin): app. and docs. subdomains are
    // often bare apps, and pages are keyed by path alone.
    if (u.hostname.replace(/^www\./, "") !== home.hostname.replace(/^www\./, "")) continue;
    const path = u.pathname.replace(/\/+$/, "") || "/";
    if (path === "/" || path.split("/").length > 4) continue;

    const entry = byPath.get(path) ?? { url: `${u.origin}${path}`, path, texts: new Set() };
    if (text) entry.texts.add(text.toLowerCase());
    byPath.set(path, entry);
  }

  const chosen = [];
  for (const type of PAGE_TYPES) {
    let best = null;
    for (const entry of byPath.values()) {
      if (chosen.some((c) => c.url === entry.url)) continue;
      // The first path segment names the section of the site: /changelog/new-product is a changelog entry.
      const pathHit = type.re.test(entry.path.toLowerCase().split("/")[1]);
      const textHit = [...entry.texts].some((t) => t.length <= 30 && type.re.test(t));
      if (!pathHit && !textHit) continue;
      // Prefer path matches, then shallow paths.
      const score = (pathHit ? 10 : 0) + (textHit ? 5 : 0) - entry.path.split("/").length;
      if (!best || score > best.score) best = { ...entry, score };
    }
    if (best) chosen.push({ url: best.url, path: best.path, pattern: type.pattern });
    if (chosen.length >= max) break;
  }
  return chosen;
}
