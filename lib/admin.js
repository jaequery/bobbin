// The local admin's guard. Server only. The admin exists only when
// JETHRO_ADMIN=1 AND the request arrived over loopback: the socket address
// (stamped by next.config.mjs), the Host header and, when sent, the Origin all
// have to be local. Anything else gets a plain 404, so the admin is invisible.
const LOOPBACK_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const hostOf = (value) => {
  try {
    return new URL(`http://${value}`).hostname;
  } catch {
    return "";
  }
};

// `headers` is a Headers object: request.headers in a route handler, or
// `await headers()` in a page.
export function isAdminRequest(headers) {
  if (process.env.JETHRO_ADMIN !== "1") return false;
  if (!LOOPBACK_IPS.has(headers.get("x-jethro-peer") || "")) return false;
  if (!LOOPBACK_HOSTS.has(hostOf(headers.get("host") || ""))) return false;
  const origin = headers.get("origin");
  if (origin) {
    try {
      if (!LOOPBACK_HOSTS.has(new URL(origin).hostname)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

// Wraps an admin route handler: 404 unless isAdminRequest, JSON `{ data }` on
// success, `{ error }` with the thrown error's `status` (default 500).
export function adminRoute(handler) {
  return async (request, ctx) => {
    if (!isAdminRequest(request.headers)) return notFound();
    try {
      const data = await handler(request, ctx);
      if (data instanceof Response) return data;
      if (data == null) return Response.json({ error: { message: "Not found" } }, { status: 404 });
      return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      return Response.json({ error: { message: err.message || "Admin request failed", fields: err.fields } }, { status });
    }
  };
}

export function httpError(status, message, fields) {
  return Object.assign(new Error(message), { status, fields });
}

// The JSON body of a mutation. Requires a JSON content type, which a
// cross-site form post cannot send without a CORS preflight.
export async function jsonBody(request) {
  if (!/^application\/json\b/i.test(request.headers.get("content-type") || "")) throw httpError(415, "Send application/json");
  try {
    return await request.json();
  } catch {
    throw httpError(400, "Body is not JSON");
  }
}
