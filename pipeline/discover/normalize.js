// Turns a candidate URL into the site Jethro stores: a canonical https://<host>/
// URL and its registrable domain, or a reason it is refused.
import { getDomain } from "tldts";
import { isOptedOut } from "../../lib/db.js";
import { resolveRedirects } from "./http.js";

// Galleries, aggregators and social networks: never a site to capture.
export const BLOCKLIST = Object.freeze([
  "awwwards.com", "godly.website", "recent.design", "land-book.com", "siteinspire.com",
  "lapa.ninja", "onepagelove.com", "httpster.net", "minimal.gallery", "dribbble.com",
  "behance.net", "instagram.com", "twitter.com", "x.com", "linkedin.com", "youtube.com",
  "medium.com", "github.com", "figma.com", "facebook.com", "pinterest.com", "tiktok.com",
  "reddit.com", "wikipedia.org", "mobbin.com", "cssdesignawards.com", "cssnectar.com",
  "curated.design", "darkmodedesign.com", "refero.design", "landing.love", "ecomm.design",
  "brutalistwebsites.com", "footer.design", "mindsparklemag.com", "deadsimplesites.com",
  "landingfolio.com", "csswinner.com", "navbar.gallery", "designnominees.com", "semplice.com",
  "webdesignclip.com", "csslight.com", "details.so", "inspo.page", "saaspages.xyz",
  "saaslandingpage.com", "sitesee.co", "landing.gallery", "cssline.com", "orpetron.com",
  "unmatchedstyle.com", "a1.gallery", "seesaw.website", "landings.dev",
  "pricingpages.design", "typ.io", "404s.design", "killerportfolio.com", "webinspoo.com",
  "astro.build", "gatsbyjs.com", "nuxt.com", "lenis.dev", "getkirby.com", "wordpress.org", "statamic.com",
  "muuuuu.org", "wallofportfolios.in",
  "osmo.supply", "madewithwagtail.org",
]);

// Link shorteners and ad trackers whose real target is behind a redirect.
const REDIRECTORS = new Set([
  "bit.ly", "t.co", "ow.ly", "buff.ly", "tinyurl.com", "lnkd.in", "goo.gl", "rebrand.ly",
  "grsm.io", "fas.st", "geni.us", "shareasale.com", "go.skimresources.com",
]);

const NON_HTML = /\.(pdf|jpe?g|png|gif|webp|svg|mp4|mov|zip|docx?|xlsx?|pptx?)$/i;

function parse(input) {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : "https://" + input);
    return /^https?:$/.test(u.protocol) ? u : null;
  } catch {
    return null;
  }
}

// The registrable domain `input` would be stored under, without resolving
// redirects or checking the blocklist; null when it has none.
export function candidateDomain(input) {
  const u = parse(String(input).trim());
  return u ? getDomain(u.hostname.replace(/\.$/, "").replace(/^www\./, ""), { allowPrivateDomains: true }) : null;
}

// Returns { url, domain } or { refused: reason }.
// `allowHosted` permits sites on shared hosts (x.framer.website, y.webflow.io);
// galleries and manual seeds may point there, web search may not.
export async function normalizeCandidate(input, { allowHosted = true, resolve = true } = {}) {
  let u = parse(String(input).trim());
  if (!u) return { refused: "not an http(s) URL" };
  if (NON_HTML.test(u.pathname)) return { refused: "not an HTML page" };

  if (resolve && REDIRECTORS.has(getDomain(u.hostname))) {
    try {
      u = parse(await resolveRedirects(u.href)) ?? u;
    } catch {
      return { refused: "redirect could not be resolved" };
    }
  }

  // URL() already lowercases and punycode-encodes IDN hosts.
  const host = u.hostname.replace(/\.$/, "").replace(/^www\./, "");
  const domain = getDomain(host, { allowPrivateDomains: true });
  if (!domain) return { refused: "no registrable domain" };
  const base = getDomain(host);
  const hosted = domain !== base;

  if (BLOCKLIST.includes(domain) || BLOCKLIST.includes(base)) return { refused: `${domain} is a gallery or social site` };
  if (REDIRECTORS.has(base)) return { refused: "unresolved redirect" };
  if (hosted && !allowHosted) return { refused: `${domain} is on a shared host` };
  if (await isOptedOut(domain)) return { refused: `${domain} has opted out` };

  return { url: `https://${host}/`, domain };
}
