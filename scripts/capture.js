// Captures one site into data/shots and the database.
// Usage: npm run capture -- <url> [--subpages] [--headed]
import { isOptedOut, normalizeDomain, recordEvent, upsertSite } from "../lib/db.js";
import { setHeaded } from "../pipeline/browser.js";
import { captureHome, captureSubpages, closeBrowser } from "../pipeline/capture.js";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const target = args.find((a) => !a.startsWith("--"));

if (!target) {
  console.error("usage: npm run capture -- <url> [--subpages] [--headed]");
  process.exit(2);
}

let url;
try {
  url = new URL(/^https?:\/\//i.test(target) ? target : `https://${target}`);
} catch {
  console.error(`not a URL: ${target}`);
  process.exit(2);
}

const domain = normalizeDomain(url.hostname);
const started = Date.now();
setHeaded(flags.has("--headed"));

// Never create a site row for an opted-out domain.
if (isOptedOut(domain)) {
  recordEvent(null, "capture_skipped", { reason: "optout", domain });
  console.error(`skipped ${domain}: the domain has opted out of Bobbin`);
  process.exit(3);
}

const existing = upsertSite({ domain, source: "manual" });
const site = existing.url ? existing : upsertSite({ domain, url: url.href });

let code = 0;
try {
  const home = await captureHome(site);
  const totals = { pages: home.pages, screens: home.screens, sections: home.sections };
  if (flags.has("--subpages")) {
    const sub = await captureSubpages(site, { links: home.links });
    totals.pages += sub.pages;
    totals.screens += sub.screens;
    totals.sections += sub.sections;
    for (const s of sub.skipped) console.warn(`  skipped ${s.path}: ${s.reason}`);
  }
  console.log(`captured ${domain} (site ${site.id}): ${totals.pages} pages, ${totals.screens} screens, ${totals.sections} sections in ${Date.now() - started} ms`);
} catch (err) {
  const skipped = err.code === "optout" || err.code === "robots_disallowed";
  console.error(`${skipped ? "skipped" : "failed"} ${domain}: ${err.message}`);
  code = skipped ? 3 : 1;
} finally {
  await closeBrowser();
}
process.exit(code);
