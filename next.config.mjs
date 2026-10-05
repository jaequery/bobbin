import http from "node:http";

// Stamps every request with the address of the socket it came in on, replacing
// any client-sent value, so lib/admin.js and the removal rate limit can tell a
// loopback caller from a remote one. Next itself only fills X-Forwarded-For when
// the client did not send one, which makes that header spoofable. The config
// loads in the server process before it handles any request.
if (!globalThis.__jethroPeerStamp) {
  globalThis.__jethroPeerStamp = true;
  const emit = http.Server.prototype.emit;
  http.Server.prototype.emit = function (event, req, ...rest) {
    if (event === "request" && req?.headers) req.headers["x-jethro-peer"] = req.socket?.remoteAddress || "";
    return emit.call(this, event, req, ...rest);
  };
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The cron pipeline launches Chromium: Playwright reads files the tracer
  // misses (browsers.json), and @sparticuz/chromium unpacks its bin/ at runtime.
  outputFileTracingIncludes: {
    "/api/cron/pipeline": ["./node_modules/playwright-core/**/*", "./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
