// Page prep before a screenshot: load, clear consent banners and chat widgets,
// trigger lazy images, wait for fonts and the network to settle.

// css px; taller pages are clipped. Lower on Vercel, where a function has at
// most 3 GB and a full-page shot of a 12000px page at 2x ran it out of memory.
export const MAX_HEIGHT = process.env.VERCEL ? 6000 : 12000;

const CONSENT_BUTTONS = [
  "#onetrust-accept-btn-handler",
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  "#CybotCookiebotDialogBodyButtonAccept",
  "[data-testid*=accept i]",
  "[data-testid=uc-accept-all-button]",
  ".cc-allow",
  ".cky-btn-accept",
  "#didomi-notice-agree-button",
  ".fc-cta-consent",
];

const ACCEPT_TEXT = /^(accept( all( cookies)?)?|accept cookies|allow( all)?( cookies)?|agree|i agree|agree and close|got it|ok(ay)?|alle akzeptieren|akzeptieren|tout accepter|accepter|j'accepte|aceptar( todo)?|accetta( tutto)?|alles accepteren|accepteren)$/i;
const CONSENT_SCOPE = /cookie|consent|gdpr|privacy|cmp|didomi|onetrust|usercentrics|sp_message/i;

const HIDE_CSS = `
  #intercom-container, .intercom-lightweight-app, #intercom-frame,
  #hubspot-messages-iframe-container, .crisp-client, #drift-widget, #drift-frame-controller,
  [id^=chat-widget], iframe[title*=chat i], #launcher, .zEWidget-launcher, #zsiq_float,
  #onetrust-consent-sdk, #CybotCookiebotDialog, #usercentrics-root, .cc-window, .cky-consent-container,
  #didomi-host, .fc-consent-root, [id^=sp_message_container], #truste-consent-track,
  #transcend-consent-manager, #ketch-consent-banner, #cmpbox, #cmpbox2,
  #credential_picker_container
  { display: none !important; visibility: hidden !important; }
  *, *::before, *::after { caret-color: transparent !important; }
`;

export class Blocked extends Error {
  constructor(reason) {
    super(reason);
    this.name = "Blocked";
    this.code = "blocked";
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Runs in the page: true when `el` sits inside consent UI. That is an ancestor
// (climbing out of shadow roots) whose tag, id, class or aria-label says so, or
// a small container whose own text is about cookies: class names can be hashed
// (airbnb) and the UI can be web components (Usercentrics on porsche.com).
function inConsentScope(el, scope) {
  const scopeRe = new RegExp(scope, "i");
  const LIMIT = 5000;
  const parentOf = (n) => n.parentElement || n.getRootNode().host || null;
  // The node's text including its shadow roots (innerText stops at each one),
  // or null once it passes LIMIT: a container that big is the page, not a banner.
  const textOf = (node) => {
    let text = "";
    const walk = (root) => {
      for (const child of root.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) text += child.data;
        else if (child.nodeType === Node.ELEMENT_NODE && !/^(STYLE|SCRIPT|NOSCRIPT|TEMPLATE)$/.test(child.tagName)) {
          if (child.shadowRoot) walk(child.shadowRoot);
          walk(child);
        }
        if (text.length > LIMIT) return;
      }
    };
    if (node.shadowRoot) walk(node.shadowRoot);
    walk(node);
    return text.length > LIMIT ? null : text;
  };
  for (let n = parentOf(el); n && n !== document.body && n !== document.documentElement; n = parentOf(n)) {
    if (scopeRe.test(`${n.tagName} ${n.id} ${typeof n.className === "string" ? n.className : ""} ${n.getAttribute("aria-label") || ""}`)) return true;
    const text = textOf(n);
    if (text === null) return false;
    if (/cookie|tracking technolog|consent/i.test(text)) return true;
  }
  return false;
}

// Clicks with a real (trusted) click, which some consent managers require, then
// returns to the top: the click scrolls the button into view.
async function realClick(page, locator) {
  await locator.click({ timeout: 3000 }).catch(() => locator.evaluate((el) => el.click()).catch(() => {}));
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
}

async function clickConsent(page) {
  for (const frame of page.frames()) {
    // Known consent-manager buttons, searched through shadow roots.
    const marked = await frame.evaluate((selectors) => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
      };
      const roots = [document];
      for (let i = 0; i < roots.length; i++) {
        for (const el of roots[i].querySelectorAll("*")) if (el.shadowRoot) roots.push(el.shadowRoot);
      }
      for (const sel of selectors) {
        const el = roots.flatMap((r) => [...r.querySelectorAll(sel)]).find(visible);
        if (el) { el.setAttribute("data-jethro-consent", ""); return true; }
      }
      return false;
    }, CONSENT_BUTTONS).catch(() => false);
    if (marked) {
      // CSS locators pierce open shadow roots.
      const target = frame.locator("[data-jethro-consent]").first();
      await realClick(page, target);
      await target.evaluate((el) => el.removeAttribute("data-jethro-consent")).catch(() => {});
      return true;
    }

    // Any button whose accessible name says accept, inside consent UI. Accessible
    // names include slotted text, so design-system buttons (<uc-p-button>) count.
    // A page can hold several (porsche.com has an "Agree" that saves a settings
    // form far down the page), so prefer one on screen, then an "accept all".
    const inConsentFrame = frame !== page.mainFrame() && CONSENT_SCOPE.test(frame.url());
    const buttons = frame.getByRole("button", { name: ACCEPT_TEXT });
    const count = Math.min(await buttons.count().catch(() => 0), 10);
    const candidates = [];
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      if (!(await button.isVisible().catch(() => false))) continue;
      if (!inConsentFrame && !(await button.evaluate(inConsentScope, CONSENT_SCOPE.source).catch(() => false))) continue;
      const facts = await button.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const label = `${el.innerText} ${el.getRootNode().host?.textContent ?? ""} ${el.getAttribute("aria-label") ?? ""}`;
        return { onScreen: r.bottom > 0 && r.top < innerHeight, all: /\b(all|alle|tout|todo|tutto|alles)\b/i.test(label) };
      }).catch(() => ({}));
      candidates.push({ button, rank: (facts.onScreen ? 2 : 0) + (facts.all ? 1 : 0) });
    }
    candidates.sort((a, b) => b.rank - a.rank);
    if (candidates.length) {
      await realClick(page, candidates[0].button);
      return true;
    }
  }
  return false;
}

// Whatever survived the click: fixed or sticky overlays that look like consent UI.
async function removeConsentOverlays(page) {
  await page.evaluate((scope) => {
    const re = new RegExp(scope, "i");
    for (const el of document.querySelectorAll("body *")) {
      const pos = getComputedStyle(el).position;
      if (pos !== "fixed" && pos !== "sticky") continue;
      const label = `${el.id} ${typeof el.className === "string" ? el.className : ""} ${el.getAttribute("aria-label") || ""}`;
      if (re.test(label) && !/^(header|nav)$/i.test(el.tagName)) el.remove();
    }
    for (const el of [document.documentElement, document.body]) {
      if (getComputedStyle(el).overflow === "hidden") el.style.setProperty("overflow", "visible", "important");
    }
  }, CONSENT_SCOPE.source).catch(() => {});
}

async function autoScroll(page) {
  await page.evaluate(async (max) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let y = 0; y < Math.min(document.documentElement.scrollHeight, max); y += 600) {
      window.scrollTo(0, y);
      await wait(120);
    }
    window.scrollTo(0, 0);
    await wait(200);
  }, MAX_HEIGHT);
}

// Loads `url` in `page` and leaves it ready to screenshot. Returns the final URL and title.
export async function preparePage(page, url) {
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {});

  const title = (await page.title().catch(() => "")).trim();
  if (/^(just a moment|attention required|access denied|verifying you are human)/i.test(title) || res?.status() === 403 || res?.status() === 429) {
    throw new Blocked(`blocked (${res?.status() ?? "no response"} "${title}")`);
  }

  if (await clickConsent(page)) await sleep(600);
  await page.addStyleTag({ content: HIDE_CSS }).catch(() => {});
  await removeConsentOverlays(page);

  await autoScroll(page);
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  // Late banners and widgets that mounted during the scroll.
  if (await clickConsent(page)) await sleep(400);
  await removeConsentOverlays(page);
  await sleep(800);
  // Some sites restore their own scroll position after a consent click; sticky
  // headers must be drawn as at the top of the page.
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

  return { finalUrl: page.url(), title, status: res?.status() ?? null };
}
