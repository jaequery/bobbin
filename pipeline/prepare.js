// Page prep before a screenshot: load, clear consent banners and chat widgets,
// trigger lazy images, wait for fonts and the network to settle.

export const MAX_HEIGHT = 12000; // css px; taller pages are clipped

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

async function clickConsent(page) {
  for (const frame of page.frames()) {
    const clicked = await frame.evaluate(({ selectors, text, scope }) => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
      };
      // Consent managers (Transcend, Usercentrics...) often render in shadow roots.
      const roots = [document];
      for (let i = 0; i < roots.length; i++) {
        for (const el of roots[i].querySelectorAll("*")) if (el.shadowRoot) roots.push(el.shadowRoot);
      }
      const all = (sel) => roots.flatMap((r) => [...r.querySelectorAll(sel)]);
      // Climbs out of shadow roots to the host element.
      const parentOf = (n) => n.parentElement || n.getRootNode().host || null;
      for (const sel of selectors) {
        const el = all(sel).find(visible);
        if (el) { el.click(); return true; }
      }
      const textRe = new RegExp(text, "i");
      const scopeRe = new RegExp(scope, "i");
      const inFrame = window !== window.top && scopeRe.test(location.href);
      for (const el of all("button, a[role=button], [role=button], input[type=button], input[type=submit]")) {
        const label = (el.innerText || el.value || "").trim().replace(/\s+/g, " ");
        if (!label || label.length > 40 || !textRe.test(label) || !visible(el)) continue;
        let inScope = inFrame;
        for (let n = el; n && !inScope && n !== document.body; n = parentOf(n)) {
          inScope = scopeRe.test(`${n.id} ${typeof n.className === "string" ? n.className : ""} ${n.getAttribute("aria-label") || ""}`);
        }
        if (inScope) { el.click(); return true; }
      }
      return false;
    }, { selectors: CONSENT_BUTTONS, text: ACCEPT_TEXT.source, scope: CONSENT_SCOPE.source }).catch(() => false);
    if (clicked) return true;
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

  return { finalUrl: page.url(), title, status: res?.status() ?? null };
}
