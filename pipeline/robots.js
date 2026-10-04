// Guardrails checked before any page load: opt-outs first, then robots.txt.
import robotsParser from "robots-parser";
import { isOptedOut, normalizeDomain } from "../lib/db.js";
import { BOT_NAME } from "./browser.js";

export class RobotsDisallowed extends Error {
  constructor(url) {
    super(`robots.txt disallows ${BOT_NAME} from ${url}`);
    this.name = "RobotsDisallowed";
    this.code = "robots_disallowed";
  }
}

export class OptedOut extends Error {
  constructor(domain) {
    super(`${domain} has opted out of Jethro`);
    this.name = "OptedOut";
    this.code = "optout";
  }
}

// origin -> Promise<robots parser | null>. In-memory for the process lifetime.
const cache = new Map();

function loadRobots(origin) {
  if (!cache.has(origin)) {
    const robotsUrl = `${origin}/robots.txt`;
    cache.set(origin, (async () => {
      try {
        const res = await fetch(robotsUrl, {
          signal: AbortSignal.timeout(5000),
          headers: { "user-agent": `${BOT_NAME}/1.0` },
          redirect: "follow",
        });
        // 4xx means no rules; 5xx or a network failure is treated the same, leniently.
        if (!res.ok) return null;
        return robotsParser(robotsUrl, await res.text());
      } catch {
        return null;
      }
    })());
  }
  return cache.get(origin);
}

// Throws OptedOut or RobotsDisallowed; resolves when the URL may be captured.
export async function assertAllowed(url) {
  const { origin, hostname } = new URL(url);
  const domain = normalizeDomain(hostname);
  if (isOptedOut(domain)) throw new OptedOut(domain);
  const robots = await loadRobots(origin);
  // isAllowed() picks the JethroBot group when present and falls back to `*`.
  if (robots && robots.isAllowed(url, BOT_NAME) === false) throw new RobotsDisallowed(url);
}
