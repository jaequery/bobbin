// Finds a page's top-level visual blocks (nav, hero, feature bands, footer...)
// so each can be cropped out of the full-page screenshot.
import { SECTION_TYPES } from "../lib/taxonomy.js";

export const MAX_SECTIONS = 20;
const MIN_HEIGHT = 160;
const TINY = 120; // blocks shorter than this merge into a neighbour

// Runs in the page. Returns [{ y, height, tag, id, class }] in css px, top to bottom.
function collectBlocks({ minHeight, maxHeight }) {
  const vw = document.documentElement.clientWidth;
  const scrollY = window.scrollY;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { y: Math.round(r.top + scrollY), height: Math.round(r.height), width: r.width };
  };
  const shown = (el) => {
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && s.position !== "fixed" && s.position !== "absolute";
  };
  const semantic = (el) => /^(HEADER|NAV|SECTION|FOOTER|ARTICLE|ASIDE)$/.test(el.tagName) ||
    /section/i.test(typeof el.className === "string" ? el.className : "");
  const wide = (el) => box(el).width >= vw * 0.8;
  // Visible children; `display: contents` wrappers have no box, so their children stand in.
  const kids = (el) => [...el.children].flatMap((c) => {
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|LINK|META)$/.test(c.tagName)) return [];
    if (getComputedStyle(c).display === "contents") return kids(c);
    return shown(c) ? [c] : [];
  });

  // Descend through single-child wrappers (#__next > div > main ...) until a level
  // with several wide children: that level is the page's stack of sections.
  let root = document.body;
  for (let depth = 0; depth < 8; depth++) {
    const wideKids = kids(root).filter((c) => wide(c) && box(c).height > 0);
    if (wideKids.length >= 3) break;
    const biggest = wideKids.sort((a, b) => box(b).height - box(a).height)[0];
    if (!biggest || box(biggest).height < window.innerHeight * 0.5) break;
    root = biggest;
  }

  // The element under `el` (through single-child wrappers) whose children stack
  // two or more section-sized blocks, or null.
  const stackOf = (el) => {
    for (let n = el, depth = 0; n && depth < 6; depth++) {
      const ks = kids(n).filter((c) => box(c).width >= vw * 0.5 && box(c).height > 0);
      const big = ks.filter((c) => box(c).height >= minHeight);
      if (big.length >= 2) return n;
      n = big.length === 1 ? big[0] : ks.length === 1 ? ks[0] : null;
    }
    return null;
  };

  const out = [];
  const visit = (parent, level) => {
    for (const el of kids(parent)) {
      const b = box(el);
      // Top level wants full-bleed bands; inside a container, centered content columns count too.
      if (b.height <= 0 || b.width < vw * (level ? 0.5 : 0.8)) continue;
      // A <main>, or any block taller than 1.5 screens that stacks section-sized
      // children, holds sections of its own.
      const tall = !/^(HEADER|NAV|FOOTER)$/.test(el.tagName) && b.height > window.innerHeight * 1.5;
      const inner = (el.tagName === "MAIN" || tall) && level < 4 ? stackOf(el) : null;
      if (inner) { visit(inner, level + 1); continue; }
      if (b.height < minHeight && !/^(HEADER|NAV)$/.test(el.tagName) && !semantic(el)) {
        if (b.height >= 24) out.push({ y: b.y, height: b.height, tag: el.tagName.toLowerCase(), id: el.id || "", class: "", small: true });
        continue;
      }
      out.push({
        y: b.y, height: b.height, tag: el.tagName.toLowerCase(), id: el.id || "",
        class: typeof el.className === "string" ? el.className.slice(0, 200) : "",
      });
    }
  };
  visit(root, 0);
  return out
    .filter((s) => s.y < maxHeight)
    .map((s) => ({ ...s, y: Math.max(0, s.y), height: Math.min(s.height, maxHeight - Math.max(0, s.y)) }))
    .sort((a, b) => a.y - b.y);
}

// Merges tiny blocks into the block that follows, folds overlaps into the outer
// block, and clamps everything to the captured height.
export function tidySections(blocks, captureHeight) {
  const merged = [];
  let carry = null;
  for (const b of blocks) {
    let s = { ...b };
    if (carry) {
      const top = Math.min(carry.y, s.y);
      s = { ...s, y: top, height: Math.max(carry.y + carry.height, s.y + s.height) - top };
      carry = null;
    }
    const prev = merged[merged.length - 1];
    if (prev && s.y < prev.y + prev.height - 8) {
      prev.height = Math.max(prev.y + prev.height, s.y + s.height) - prev.y;
      continue;
    }
    if (s.small || s.height < TINY) carry = s;
    else merged.push(s);
  }
  if (carry && merged.length) {
    const last = merged[merged.length - 1];
    last.height = Math.max(last.y + last.height, carry.y + carry.height) - last.y;
  }
  return merged
    .map(({ small, ...s }) => ({ ...s, height: Math.min(s.height, captureHeight - s.y) }))
    .filter((s) => s.height >= MIN_HEIGHT || (s.height >= 40 && /^(header|nav|footer)$/.test(s.tag)))
    .slice(0, MAX_SECTIONS);
}

export async function findSections(page, captureHeight) {
  const blocks = await page.evaluate(collectBlocks, { minHeight: MIN_HEIGHT, maxHeight: captureHeight });
  return tidySections(blocks, captureHeight);
}

// A first guess at the section type from tag and class names; the AI judge refines it.
export function guessSectionType(s, index, count) {
  const type = guess(s, index, count);
  return SECTION_TYPES.includes(type) ? type : null;
}

function guess(s, index, count) {
  const hint = `${s.tag} ${s.id} ${s.class}`.toLowerCase();
  if (s.tag === "nav" || (s.tag === "header" && index === 0 && s.height < 200) || /\bnav(bar|igation)?\b/.test(hint)) return "Navigation";
  if (s.tag === "footer" || /footer/.test(hint) || (index === count - 1 && /bottom/.test(hint))) return "Footer";
  if (/hero|masthead|banner|jumbotron/.test(hint)) return "Hero";
  if (/pricing|plans/.test(hint)) return "Pricing table";
  if (/faq|questions/.test(hint)) return "FAQ";
  if (/testimonial|review|quote/.test(hint)) return "Testimonials";
  if (/logo|customers|trusted|brands/.test(hint)) return "Logo cloud";
  if (/newsletter|subscribe/.test(hint)) return "Newsletter";
  if (/stat|metric|number/.test(hint)) return "Stats";
  if (/team|people/.test(hint)) return "Team";
  if (/gallery|showcase|portfolio/.test(hint)) return "Gallery";
  if (/cta|call-to-action|get-started|signup/.test(hint)) return "CTA";
  if (/feature|benefit/.test(hint)) return "Features";
  if (index <= 1 && s.y < 1000) return "Hero";
  return null;
}
