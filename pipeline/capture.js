// The capture engine: loads a site's pages at desktop and mobile widths, stores
// full-page, thumbnail and per-section WebP images as shots under <siteId>/
// (lib/shots.js), and records them as pages, screens and sections rows.
//
// Exports captureHome, captureSubpages and closeBrowser so a caller can reuse
// one browser across many sites.
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  deletePage, deleteScreensForPage, getSite, insertPage, insertScreen, insertSection,
  isOptedOut, listPages, recordEvent, tx, upsertSite,
} from "../lib/db.js";
import { colorTags } from "../lib/color.js";
import { reindexSite } from "../lib/search.js";
import { putShot, removeShots } from "../lib/shots.js";
import { PLATFORMS } from "../lib/taxonomy.js";
import { closeBrowser, newContext, VIEWPORTS } from "./browser.js";
import { MAX_HEIGHT, preparePage } from "./prepare.js";
import { findSections, guessSectionType } from "./sections.js";
import { collectLinks, pickSubpages, registrableDomain } from "./links.js";
import { assertAllowed, OptedOut } from "./robots.js";

export { closeBrowser };

const MAX_ATTEMPTS = 3;
const POLITE_MS = 1000;
// Hard ceiling for loading and shooting one page at one viewport. Some steps
// (page scripts, font loading) have no timeout of their own and can hang on a
// slow machine; closing the context makes every pending call fail instead.
const SHOOT_TIMEOUT_MS = 120000;
const WEBP_MAX = 16383; // WebP's hard limit on either side

// Output sizes per platform: thumbnails are top crops at a fixed aspect.
const SIZES = {
  desktop: { full: 1440, lg: [1200, 750], sm: [600, 375], section: 1200, sectionSm: 480 },
  mobile: { full: 585, lg: [600, 1300], sm: [300, 650], section: 585, sectionSm: 240 },
};

class CaptureError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

/* ---------- Politeness: one page load per domain per second ---------- */

const lastLoad = new Map();

async function politeWait(domain) {
  const wait = (lastLoad.get(domain) ?? 0) + POLITE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastLoad.set(domain, Date.now());
}

/* ---------- Colors ---------- */

const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))));
  return hex(f(0), f(8), f(4));
}

const fromHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

// Dominant color plus up to 5 distinct colors from the first fold.
async function paletteOf(image) {
  const { dominant } = await sharp(image).stats();
  const { data } = await sharp(image).resize(8, 8, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = new Map();
  for (let i = 0; i < data.length; i += 3) {
    // Quantize so near-identical pixels count together.
    const q = [data[i], data[i + 1], data[i + 2]].map((v) => Math.min(255, Math.round(v / 24) * 24));
    const key = hex(...q);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const palette = [];
  for (const [color] of [...counts].sort((a, b) => b[1] - a[1])) {
    if (palette.every((p) => distance(fromHex(p), fromHex(color)) > 48)) palette.push(color);
    if (palette.length === 5) break;
  }
  return { dominant: hex(dominant.r, dominant.g, dominant.b), palette };
}

// A soft light → dark pair from the site's dominant hue, for card backdrops.
function tonesOf(dominant, palette) {
  const hsl = [dominant, ...palette].map((c) => rgbToHsl(...fromHex(c)));
  const [h, s] = hsl.find(([, sat, l]) => sat > 0.2 && l > 0.1 && l < 0.9) ?? hsl[0];
  const sat = Math.min(s, 0.35);
  return [hslToHex(h, sat, 0.82), hslToHex(h, sat, 0.4)];
}

/* ---------- Loading and screenshotting one page ---------- */

// Loads `url` at one viewport and returns the screenshot plus layout facts.
async function shoot(site, url, platform, { wantLinks = false } = {}) {
  const context = await newContext(platform);
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; context.close().catch(() => {}); }, SHOOT_TIMEOUT_MS);
  try {
    const page = await context.newPage();
    await politeWait(site.domain);
    const { finalUrl, title } = await preparePage(page, url);

    if (registrableDomain(new URL(finalUrl).hostname) !== registrableDomain(site.domain)) {
      throw Object.assign(new CaptureError("redirected_offsite", `redirected offsite to ${finalUrl}`), { finalUrl });
    }

    const docHeight = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0));
    const { width, height: viewHeight } = VIEWPORTS[platform].viewport;
    // Pages that scroll inside a 100vh container report no extra height: Playwright
    // then shoots the viewport, which is the fallback we want.
    const height = Math.max(viewHeight, Math.min(docHeight, MAX_HEIGHT));
    const png = await page.screenshot({
      type: "png",
      fullPage: true,
      clip: { x: 0, y: 0, width, height },
      animations: "disabled",
      caret: "hide",
      timeout: 60000,
    });
    const sections = await findSections(page, height);
    const links = wantLinks ? await collectLinks(page) : [];
    return { png, height, title, finalUrl, sections, links };
  } catch (err) {
    if (timedOut) throw new CaptureError("timeout", `${platform} capture took over ${SHOOT_TIMEOUT_MS / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
    await context.close().catch(() => {});
  }
}

/* ---------- Writing images ---------- */

const slugOf = (p) => (p === "/" ? "home" : p.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "page");

async function writeWebp(pipeline, rel, quality) {
  const buf = await pipeline.webp({ quality, effort: 5 }).toBuffer({ resolveWithObject: true });
  await putShot(rel, buf.data);
  return buf.info;
}

// Writes full, lg, sm and section images for one screenshot. Returns screen
// fields and section rows, with shot paths.
async function writeScreen(site, slug, platform, shot) {
  const size = SIZES[platform];
  const dpr = VIEWPORTS[platform].deviceScaleFactor;
  const dir = site.id;

  const meta = await sharp(shot.png).metadata();
  const base = `${dir}/${slug}-${platform}`;

  // Full page, downscaled to keep a site's disk use small (thumbnails and section
  // crops carry the crisp detail), and always within WebP's size limit.
  const fullWidth = Math.min(size.full, Math.floor((meta.width * WEBP_MAX) / meta.height));
  const full = sharp(shot.png, { limitInputPixels: false }).resize({ width: fullWidth });
  const fullInfo = await writeWebp(full, `${base}-full.webp`, 80);

  // Thumbnails: crop the top of the page at the platform's aspect.
  const [lgW, lgH] = size.lg;
  const cropH = Math.min(meta.height, Math.round((meta.width * lgH) / lgW));
  const top = await sharp(shot.png, { limitInputPixels: false })
    .extract({ left: 0, top: 0, width: meta.width, height: cropH })
    .png()
    .toBuffer();
  const thumb = (w, h) => sharp(top).resize(w, h, { fit: "cover", position: "top" });
  await writeWebp(thumb(lgW, lgH), `${base}-lg.webp`, 82);
  await writeWebp(thumb(...size.sm), `${base}-sm.webp`, 80);

  const sections = [];
  for (const [i, s] of shot.sections.entries()) {
    const y = Math.round(s.y * dpr);
    const h = Math.min(Math.round(s.height * dpr), meta.height - y);
    if (h < 40 * dpr) continue;
    if (Math.round((h * size.section) / meta.width) > WEBP_MAX) continue;
    const id = randomUUID();
    const crop = () => sharp(shot.png, { limitInputPixels: false }).extract({ left: 0, top: y, width: meta.width, height: h });
    const imgPath = `${dir}/sections/${id}.webp`;
    const smPath = `${dir}/sections/${id}-sm.webp`;
    await writeWebp(crop().resize({ width: size.section }), imgPath, 74);
    await writeWebp(crop().resize({ width: size.sectionSm }), smPath, 78);
    sections.push({ id, type: guessSectionType(s, i, shot.sections.length), y: s.y, height: s.height, imgPath, smPath });
  }

  const colors = await paletteOf(top);
  return {
    screen: {
      platform, width: fullInfo.width, height: fullInfo.height,
      fullPath: `${base}-full.webp`, lgPath: `${base}-lg.webp`, smPath: `${base}-sm.webp`,
      dominant: colors.dominant, palette: colors.palette, ...colorTags(colors.dominant, colors.palette),
    },
    sections,
    colors,
  };
}

/* ---------- One page, both platforms ---------- */

async function capturePage(site, { url, path: pagePath, pattern }, { wantLinks = false } = {}) {
  await assertAllowed(url);

  const shots = {};
  for (const { id: platform } of PLATFORMS) {
    shots[platform] = await shoot(site, url, platform, { wantLinks: wantLinks && platform === "desktop" });
  }

  const slug = slugOf(pagePath);
  const written = {};
  for (const { id: platform } of PLATFORMS) written[platform] = await writeScreen(site, slug, platform, shots[platform]);

  const capturedAt = new Date().toISOString();
  const { stale, page } = await tx(async () => {
    const page = await insertPage({ siteId: site.id, url: shots.desktop.finalUrl, path: pagePath, pattern, title: shots.desktop.title || null, capturedAt });
    const stale = await deleteScreensForPage(page.id);
    for (const { id: platform } of PLATFORMS) {
      const screen = await insertScreen({ siteId: site.id, pageId: page.id, capturedAt, ...written[platform].screen });
      for (const s of written[platform].sections) await insertSection({ ...s, screenId: screen.id, siteId: site.id });
    }
    return { stale, page };
  });
  await reindexSite(site.id);

  // Old files this capture did not overwrite.
  const fresh = new Set(PLATFORMS.flatMap(({ id }) => [
    written[id].screen.fullPath, written[id].screen.lgPath, written[id].screen.smPath,
    ...written[id].sections.flatMap((s) => [s.imgPath, s.smPath]),
  ]));
  await removeShots(stale.filter((p) => !fresh.has(p)));

  return {
    page,
    screens: PLATFORMS.length,
    sections: PLATFORMS.reduce((n, { id }) => n + written[id].sections.length, 0),
    colors: written.desktop.colors,
    links: shots.desktop.links,
    finalUrl: shots.desktop.finalUrl,
  };
}

/* ---------- Sites ---------- */

function siteUrl(site) {
  return site.url || `https://${site.domain}/`;
}

// Records a failed capture. Permanent problems fail the site at once; others
// after MAX_ATTEMPTS tries.
async function recordFailure(site, err, previousStatus) {
  const code = err.code || "error";
  const permanent = ["redirected_offsite", "blocked", "robots_disallowed"].includes(code);
  const attempts = (site.attempts ?? 0) + 1;
  const failed = permanent || attempts >= MAX_ATTEMPTS;
  await upsertSite({
    domain: site.domain,
    attempts,
    lastError: code === "error" ? String(err.message).slice(0, 500) : code,
    status: failed ? "failed" : previousStatus,
    ...(err.finalUrl ? { url: err.finalUrl } : {}),
  });
  await recordEvent(site.id, "capture_failed", { code, message: String(err.message).slice(0, 500), attempts, url: siteUrl(site) });
}

// Opted-out or robots-disallowed: nothing is written, the reason is logged.
async function recordSkip(site, err) {
  if (err instanceof OptedOut) await upsertSite({ domain: site.domain, status: "optout" });
  await recordEvent(site.id, "capture_skipped", { reason: err.code, message: err.message });
}

const isSkip = (err) => err.code === "optout" || err.code === "robots_disallowed";

// Captures a site's home page at both viewports and marks the site captured.
// Returns { pages, screens, sections, links } or throws after recording the failure.
export async function captureHome(siteOrId) {
  const site = typeof siteOrId === "string" ? await getSite(siteOrId) : (await getSite(siteOrId.id)) ?? siteOrId;
  // A site the pipeline claimed (queued) goes back to discovered on a retryable failure.
  const previousStatus = site.status === "queued" ? "discovered" : site.status;
  if (await isOptedOut(site.domain)) {
    const err = new OptedOut(site.domain);
    await recordSkip(site, err);
    throw err;
  }
  await upsertSite({ domain: site.domain, status: "capturing" });
  try {
    const home = new URL(siteUrl(site));
    const result = await capturePage(site, { url: home.href, path: "/", pattern: "Home" }, { wantLinks: true });
    const [toneA, toneB] = tonesOf(result.colors.dominant, result.colors.palette);
    await upsertSite({
      domain: site.domain,
      url: result.finalUrl,
      status: "captured",
      capturedAt: new Date().toISOString(),
      toneA, toneB,
      palette: result.colors.palette,
      lastError: null,
    });
    await recordEvent(site.id, "captured", { path: "/", sections: result.sections });
    return { pages: 1, screens: result.screens, sections: result.sections, links: result.links };
  } catch (err) {
    if (isSkip(err)) {
      if (err.code === "robots_disallowed") await upsertSite({ domain: site.domain, status: "failed", lastError: err.code });
      await recordSkip(site, err);
    } else {
      await recordFailure(site, err, previousStatus);
    }
    throw err;
  }
}

// Captures up to `max` internal pages linked from the home page. Pass `links`
// from captureHome to skip reloading the home page. A failing subpage is
// logged and skipped; the site's status is left alone.
export async function captureSubpages(siteOrId, { max = 8, links } = {}) {
  const site = typeof siteOrId === "string" ? await getSite(siteOrId) : (await getSite(siteOrId.id)) ?? siteOrId;
  const home = siteUrl(site);
  if (!links) {
    await assertAllowed(home);
    links = (await shoot(site, home, "desktop", { wantLinks: true })).links;
  }
  const targets = pickSubpages(links, home, max);
  const totals = { pages: 0, screens: 0, sections: 0, skipped: [] };
  for (const target of targets) {
    try {
      const r = await capturePage(site, target);
      totals.pages++;
      totals.screens += r.screens;
      totals.sections += r.sections;
      await recordEvent(site.id, "captured", { path: target.path, sections: r.sections });
    } catch (err) {
      totals.skipped.push({ path: target.path, reason: err.code || err.message });
      await recordEvent(site.id, isSkip(err) ? "capture_skipped" : "capture_failed", { path: target.path, code: err.code ?? null, message: String(err.message).slice(0, 500) });
      if (err instanceof OptedOut) break;
    }
  }

  // Subpages an earlier run picked that this one did not: drop them so the
  // site's set of pages matches the current selection.
  const keep = new Set(["/", ...targets.map((t) => t.path)]);
  for (const page of await listPages(site.id)) {
    if (keep.has(page.path)) continue;
    await removeShots(await deletePage(page.id));
  }
  await reindexSite(site.id);
  return totals;
}
