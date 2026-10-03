// One shared headless Chromium for the capture pipeline, plus a browser context
// per viewport. Reuse the browser across many sites; call closeBrowser() at exit.
import { chromium } from "playwright";

const CHROME = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1";

export const BOT_NAME = "BobbinBot";

// Keyed by platform id from lib/taxonomy.js.
export const VIEWPORTS = {
  desktop: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    userAgent: `${CHROME} ${BOT_NAME}/1.0`,
  },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: `${MOBILE} ${BOT_NAME}/1.0`,
  },
};

let launching = null;
let headed = false;

export function setHeaded(value) {
  headed = !!value;
}

export function getBrowser() {
  launching ??= chromium.launch({ headless: !headed }).catch((err) => {
    launching = null;
    throw err;
  });
  return launching;
}

export async function newContext(platform) {
  const browser = await getBrowser();
  return browser.newContext({
    ...VIEWPORTS[platform],
    reducedMotion: "reduce",
    colorScheme: "light",
    locale: "en-US",
    ignoreHTTPSErrors: true,
  });
}

export async function closeBrowser() {
  if (!launching) return;
  const pending = launching;
  launching = null;
  try {
    await (await pending).close();
  } catch {
    // Already gone.
  }
}
