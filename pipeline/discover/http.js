// Polite HTTP for discovery: identifies as JethroBot, waits 1s between requests
// to the same host, times out after 15s, retries twice with backoff, and checks
// the host's robots.txt before every crawl request.

export const USER_AGENT = "JethroBot/1.0 (+https://github.com/jaequery/jethro)";
const BOT = "jethrobot";
const SPACING_MS = 1000;
const TIMEOUT_MS = 15000;
const RETRIES = 2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One promise chain per host, so requests to a host run 1s apart.
const hostQueues = new Map();
function throttle(host) {
  const prev = hostQueues.get(host) ?? Promise.resolve();
  const turn = prev.then(() => sleep(SPACING_MS));
  hostQueues.set(host, turn);
  return prev;
}

async function rawFetch(url, init = {}) {
  const host = new URL(url).host;
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt) await sleep(1000 * 2 ** attempt);
    await throttle(host);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "user-agent": USER_AGENT, ...init.headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} for ${url}`);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/* ---------- robots.txt ---------- */

// Returns the Allow/Disallow rules that apply to JethroBot (its own group, or *).
export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (current && (key === "allow" || key === "disallow") && value) {
      current.rules.push({ allow: key === "allow", path: value });
    }
  }
  const own = groups.filter((g) => g.agents.some((a) => a !== "*" && BOT.includes(a)));
  const pick = own.length ? own : groups.filter((g) => g.agents.includes("*"));
  return pick.flatMap((g) => g.rules);
}

function ruleRegex(rulePath) {
  const anchored = rulePath.endsWith("$");
  const body = (anchored ? rulePath.slice(0, -1) : rulePath)
    .replace(/[.+?^{}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp("^" + body + (anchored ? "$" : ""));
}

// Longest matching rule wins; Allow wins a tie.
export function robotsAllows(rules, pathAndQuery) {
  let best = null;
  for (const rule of rules) {
    if (!ruleRegex(rule.path).test(pathAndQuery)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) best = rule;
  }
  return !best || best.allow;
}

const robotsCache = new Map();
async function robotsFor(origin) {
  if (!robotsCache.has(origin)) {
    robotsCache.set(origin, (async () => {
      try {
        const res = await rawFetch(origin + "/robots.txt");
        if (!res.ok) return []; // no robots.txt: everything allowed
        if ((res.headers.get("content-type") || "").includes("text/html")) return []; // an HTML 404 page served as 200
        return parseRobots(await res.text());
      } catch {
        return null; // unreachable: treat as disallow-all
      }
    })());
  }
  return robotsCache.get(origin);
}

export async function allowedByRobots(url) {
  const u = new URL(url);
  const rules = await robotsFor(u.origin);
  return rules !== null && robotsAllows(rules, u.pathname + u.search);
}

/* ---------- Public helpers ---------- */

// Fetches a crawl page's HTML. Throws when robots.txt forbids it or it fails.
export async function fetchHtml(url) {
  if (!(await allowedByRobots(url))) throw new Error(`robots.txt disallows ${url}`);
  const res = await rawFetch(url, { headers: { accept: "text/html" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// For APIs (no robots check): returns parsed JSON or throws.
export async function fetchJson(url, init = {}) {
  const res = await rawFetch(url, { ...init, headers: { accept: "application/json", ...init.headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Follows up to `hops` redirects with HEAD and returns the final URL.
export async function resolveRedirects(url, hops = 3) {
  let current = url;
  for (let i = 0; i < hops; i++) {
    const res = await rawFetch(current, { method: "HEAD", redirect: "manual" });
    const next = res.status >= 300 && res.status < 400 && res.headers.get("location");
    if (!next) break;
    current = new URL(next, current).href;
  }
  return current;
}
