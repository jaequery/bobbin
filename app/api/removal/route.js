import { getDomain } from "tldts";
import { addOptout, recordEvent } from "../../../lib/db";

export const dynamic = "force-dynamic";

const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;
const hits = (globalThis.__bobbinRemovalHits ??= new Map());
const LOCAL = /^(127\.|::1$|::ffff:127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc|fd)/i;

// The caller's address: the socket peer stamped by next.config.mjs, or, when
// that peer is a local or private proxy, the last X-Forwarded-For hop it added.
function clientIp(headers) {
  const peer = headers.get("x-bobbin-peer") || "";
  const hops = (headers.get("x-forwarded-for") || "").split(",").map((h) => h.trim()).filter(Boolean);
  return (!peer || LOCAL.test(peer)) && hops.length ? hops[hops.length - 1] : peer || "unknown";
}

// True when `ip` has used up its posts in the last hour; otherwise counts this one.
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}

// "https://www.Shop.example.co.uk/about" or "shop.example.co.uk" -> "example.co.uk",
// the registrable domain the library stores sites under.
function domainOf(input) {
  const raw = String(input || "").trim();
  if (!raw || raw.length > 300) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(u.protocol)) return null;
    return getDomain(u.hostname.replace(/\.$/, ""), { allowPrivateDomains: true });
  } catch {
    return null;
  }
}

const fail = (status, message, fields) => Response.json({ error: { message, fields } }, { status, headers: { "Cache-Control": "no-store" } });

// Public: records a removal request for a domain. The domain disappears from
// the library at once and is never captured again unless the admin dismisses
// the request. Whether the domain is in the library is never revealed.
export async function POST(request) {
  if (limited(clientIp(request.headers))) return fail(429, "Too many requests. Try again in an hour.");
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Send the form as JSON");
  }
  const fields = {};
  const domain = domainOf(body?.domain);
  if (!domain) fields.domain = "Enter your site's domain, like example.com";
  const email = String(body?.email || "").trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = "Enter an email address we can reach you at";
  const reason = String(body?.reason || "").trim().slice(0, 1000) || null;
  if (Object.keys(fields).length) return fail(400, "Check the highlighted fields", fields);

  try {
    addOptout({ domain, email, reason });
    recordEvent(null, "removal_requested", { domain });
  } catch (err) {
    console.error(err);
    return fail(500, "Could not record the request. Try again later.");
  }
  return Response.json({ data: { domain, message: `Thanks. ${domain} is hidden from Bobbin while we review your request.` } }, { headers: { "Cache-Control": "no-store" } });
}
