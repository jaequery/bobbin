// Jethro's Postgres database (Neon): one shared pool plus small query helpers.
// Server-only: import it from Next server code or plain `node scripts/*.js`,
// never from client components (app/Jethro.jsx, lib/jethro.js).
//
// Rows come back with snake_case columns as stored. Helpers take camelCase
// fields. JSON columns (palette, detail) accept objects and are stored as text.
// SQL uses `@name` placeholders, rewritten to `$n` for node-postgres.
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";

// Local working files (logs, pipeline scratch). Resolved at runtime;
// turbopackIgnore keeps Next from tracing the whole project for it.
export const dataDir = path.resolve(/*turbopackIgnore: true*/ process.env.JETHRO_DATA_DIR || "data");

// count(*) and other bigints come back as numbers, not strings.
pg.types.setTypeParser(20, (v) => Number.parseInt(v, 10));

// Created on first use, not at import: `next build` loads every route module to
// collect page data and must not need a database. One pool survives dev hot reloads.
function open() {
  // Neon's URLs say sslmode=require; pg treats that as verify-full and warns, so say it.
  const connectionString = process.env.DATABASE_URL?.replace(/sslmode=require\b/, "sslmode=verify-full");
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  // allowExitOnIdle lets `node scripts/*.js` exit without closing the pool.
  const pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 10000, allowExitOnIdle: true });
  if (process.env.VERCEL) attachDatabasePool(pool);
  return pool;
}
export const pool = () => (globalThis.__jethroPool ??= open());

const txStore = new AsyncLocalStorage();

// Rewrites `@name` placeholders to `$1..$n`. A name used twice gets one slot.
// `::` casts and quoted strings are left alone.
function compile(sql, params = {}) {
  if (Array.isArray(params)) return { text: sql, values: params };
  const slots = new Map();
  const values = [];
  const text = sql.replace(/'(?:[^']|'')*'|(?<![@\w])@([A-Za-z_]\w*)/g, (m, name) => {
    if (!name) return m;
    if (!(name in params)) throw new Error(`Missing SQL parameter @${name}`);
    if (!slots.has(name)) { values.push(params[name]); slots.set(name, values.length); }
    return `$${slots.get(name)}`;
  });
  return { text, values };
}

// Runs one statement on the current transaction's client, or the pool.
export async function query(sql, params) {
  const { text, values } = compile(sql, params);
  const conn = txStore.getStore() ?? pool();
  // No values: the simple protocol, which also runs multi-statement scripts.
  return values.length ? conn.query(text, values) : conn.query(text);
}
export const all = async (sql, params) => (await query(sql, params)).rows;
export const get = async (sql, params) => (await query(sql, params)).rows[0];
// The first column of the first row.
export const value = async (sql, params) => {
  const row = await get(sql, params);
  return row ? Object.values(row)[0] : undefined;
};
export const run = async (sql, params) => (await query(sql, params)).rowCount;

// Runs `fn` in a transaction. Every query/all/get/run inside it (however deep)
// uses the transaction's client; a nested tx() joins the outer one.
export async function tx(fn) {
  if (txStore.getStore()) return fn();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await txStore.run(client, fn);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const now = () => new Date().toISOString();
const json = (v) => (v == null || typeof v === "string" ? v ?? null : JSON.stringify(v));

// "WWW.Example.com." -> "example.com"
export function normalizeDomain(domain) {
  return String(domain).trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

/* ---------- Sites ---------- */

const SITE_FIELDS = {
  url: "url", name: "name", tagline: "tagline", description: "description",
  industry: "industry", country: "country", language: "language", status: "status",
  quality: "quality", qualityNotes: "quality_notes", source: "source", sourceRef: "source_ref",
  toneA: "tone_a", toneB: "tone_b", palette: "palette", discoveredAt: "discovered_at",
  capturedAt: "captured_at", judgedAt: "judged_at", approvedAt: "approved_at",
  attempts: "attempts", lastError: "last_error",
};

// Inserts a site, or updates the given fields of the site with the same domain.
// Returns the stored row.
export async function upsertSite(fields) {
  const domain = normalizeDomain(fields.domain);
  const cols = {};
  for (const [key, col] of Object.entries(SITE_FIELDS)) {
    if (fields[key] !== undefined) cols[col] = col === "palette" ? json(fields[key]) : fields[key];
  }
  cols.updated_at = now();
  const row = { id: randomUUID(), domain, discovered_at: now(), ...cols };
  const names = Object.keys(row);
  const sets = Object.keys(cols).map((c) => `${c} = excluded.${c}`).join(", ");
  return get(`
    INSERT INTO sites (${names.join(", ")}) VALUES (${names.map((c) => "@" + c).join(", ")})
    ON CONFLICT (domain) DO UPDATE SET ${sets}
    RETURNING *`, row);
}

export function getSite(id) {
  return get("SELECT * FROM sites WHERE id = @id", { id });
}

export function getSiteByDomain(domain) {
  return get("SELECT * FROM sites WHERE domain = @domain", { domain: normalizeDomain(domain) });
}

// The subset of `refs` already stored as some site's source_ref.
export async function knownSourceRefs(refs) {
  const rows = await all("SELECT source_ref FROM sites WHERE source_ref = ANY(@refs)", { refs });
  return new Set(rows.map((r) => r.source_ref));
}

export function setSiteStatus(id, status) {
  return get("UPDATE sites SET status = @status, updated_at = @now WHERE id = @id RETURNING *", { status, now: now(), id });
}

// Keyset pagination by id: pass the returned `next` as `cursor` for the next page.
export async function listSites({ status, limit = 50, cursor } = {}) {
  const where = [];
  const params = { limit };
  if (status) { where.push("status = @status"); params.status = status; }
  if (cursor) { where.push("id > @cursor"); params.cursor = cursor; }
  const items = await all(`SELECT * FROM sites ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id LIMIT @limit`, params);
  return { items, next: items.length === limit ? items[items.length - 1].id : null };
}

/* ---------- Pages, screens, sections ---------- */

// One row per (site, path): capturing the same path again updates it.
export function insertPage({ siteId, url = null, path: pagePath, pattern = null, title = null, capturedAt = now() }) {
  return get(`
    INSERT INTO pages (id, site_id, url, path, pattern, title, captured_at)
    VALUES (@id, @siteId, @url, @path, @pattern, @title, @capturedAt)
    ON CONFLICT (site_id, path) DO UPDATE SET
      url = excluded.url, pattern = excluded.pattern, title = excluded.title, captured_at = excluded.captured_at
    RETURNING *
  `, { id: randomUUID(), siteId, url, path: pagePath, pattern, title, capturedAt });
}

export function insertScreen({
  siteId, pageId = null, platform, width = null, height = null,
  fullPath = null, lgPath = null, smPath = null, dominant = null, palette = null, hueBucket = null, theme = null, capturedAt = now(),
}) {
  return get(`
    INSERT INTO screens (id, site_id, page_id, platform, width, height, full_path, lg_path, sm_path, dominant, palette, hue_bucket, theme, captured_at)
    VALUES (@id, @siteId, @pageId, @platform, @width, @height, @fullPath, @lgPath, @smPath, @dominant, @palette, @hueBucket, @theme, @capturedAt)
    RETURNING *
  `, { id: randomUUID(), siteId, pageId, platform, width, height, fullPath, lgPath, smPath, dominant, palette: json(palette), hueBucket, theme, capturedAt });
}

export function insertSection({ id = randomUUID(), screenId, siteId, type = null, y = null, height = null, imgPath = null, smPath = null }) {
  return get(`
    INSERT INTO sections (id, screen_id, site_id, type, y, height, img_path, sm_path)
    VALUES (@id, @screenId, @siteId, @type, @y, @height, @imgPath, @smPath)
    RETURNING *
  `, { id, screenId, siteId, type, y, height, imgPath, smPath });
}

export function listPages(siteId) {
  return all("SELECT * FROM pages WHERE site_id = @siteId ORDER BY path", { siteId });
}

// Deletes a page with its screens and sections. Returns the image paths to remove.
export function deletePage(pageId) {
  return tx(async () => {
    const paths = await deleteScreensForPage(pageId);
    await run("DELETE FROM pages WHERE id = @pageId", { pageId });
    return paths;
  });
}

// Deletes a page's screens (and, by cascade, their sections) before a re-capture.
// Returns the image paths those rows pointed at so the caller can remove the files.
export function deleteScreensForPage(pageId) {
  return tx(async () => {
    const screens = await all("SELECT full_path, lg_path, sm_path FROM screens WHERE page_id = @pageId", { pageId });
    const sections = await all(`
      SELECT x.img_path, x.sm_path FROM sections x JOIN screens sc ON sc.id = x.screen_id WHERE sc.page_id = @pageId`, { pageId });
    const paths = [
      ...screens.flatMap((s) => [s.full_path, s.lg_path, s.sm_path]),
      ...sections.flatMap((x) => [x.img_path, x.sm_path]),
    ];
    await run("DELETE FROM screens WHERE page_id = @pageId", { pageId });
    return paths.filter(Boolean);
  });
}

// Screens joined with their page pattern and site fields. Every filter is optional.
export function listScreens({ siteId, platform, pattern, industry, status, limit = 48, offset = 0 } = {}) {
  const where = [];
  const params = { limit, offset };
  const add = (sql, key, v) => { if (v) { where.push(sql); params[key] = v; } };
  add("sc.site_id = @siteId", "siteId", siteId);
  add("sc.platform = @platform", "platform", platform);
  add("p.pattern = @pattern", "pattern", pattern);
  add("s.industry = @industry", "industry", industry);
  add("s.status = @status", "status", status);
  return all(`
    SELECT sc.*, p.pattern, p.path, p.title AS page_title,
           s.domain, s.name AS site_name, s.industry, s.status AS site_status
    FROM screens sc
    JOIN sites s ON s.id = sc.site_id
    LEFT JOIN pages p ON p.id = sc.page_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY sc.captured_at DESC, sc.id
    LIMIT @limit OFFSET @offset
  `, params);
}

/* ---------- Events and opt-outs ---------- */

export async function recordEvent(siteId, kind, detail = null) {
  await run("INSERT INTO events (site_id, kind, detail, at) VALUES (@siteId, @kind, @detail, @at)", { siteId: siteId ?? null, kind, detail: json(detail), at: now() });
}

// Opt-out lifecycle: a removal request starts 'pending', and the admin marks it
// 'approved' (the site's files and rows are deleted) or 'dismissed'. Pending and
// approved rows hide the domain and block capture; a dismissed one does neither.
export const OPTOUT_STATUSES = Object.freeze(["pending", "approved", "dismissed"]);
// SQL condition on an optouts row (alias `o`) that blocks its domain.
export const OPTOUT_BLOCKS = "coalesce(o.status, 'pending') <> 'dismissed'";

export async function isOptedOut(domain) {
  return !!(await get(`SELECT 1 FROM optouts o WHERE o.domain = @domain AND ${OPTOUT_BLOCKS}`, { domain: normalizeDomain(domain) }));
}

export function getOptout(domain) {
  return get("SELECT * FROM optouts WHERE domain = @domain", { domain: normalizeDomain(domain) });
}

// Records a request. A new request for a dismissed domain reopens it as pending.
export async function addOptout({ domain, email = null, reason = null }) {
  const d = normalizeDomain(domain);
  await run(`
    INSERT INTO optouts (domain, email, reason, created_at, status) VALUES (@d, @email, @reason, @now, 'pending')
    ON CONFLICT (domain) DO UPDATE SET status = 'pending', email = excluded.email, reason = excluded.reason, created_at = excluded.created_at
    WHERE optouts.status = 'dismissed'
  `, { d, email, reason, now: now() });
  return getOptout(d);
}

export function setOptoutStatus(domain, status) {
  return get("UPDATE optouts SET status = @status WHERE domain = @domain RETURNING *", { status, domain: normalizeDomain(domain) });
}

export function listOptouts() {
  return all(`
    SELECT o.*, s.id AS site_id, s.status AS site_status FROM optouts o LEFT JOIN sites s ON s.domain = o.domain
    ORDER BY (o.status = 'pending') DESC NULLS LAST, o.created_at DESC
  `);
}

// Deletes a site's row; pages, screens and sections go with it by cascade.
// The caller removes its shots (lib/shots.js removeSiteShots).
export async function deleteSite(id) {
  return (await run("DELETE FROM sites WHERE id = @id", { id })) > 0;
}

/* ---------- Pipeline queue ---------- */

// The `sites` table is the pipeline's queue. A claim moves one site out of a
// resumable status into a transient one in a single UPDATE, so two pipeline
// processes can never take the same site.
const TAGGED_SINCE_APPROVAL = `EXISTS (SELECT 1 FROM events e WHERE e.site_id = sites.id AND e.kind = 'tagged' AND e.at >= sites.approved_at)`;
const TAG_ERRORS_SINCE_APPROVAL = `(SELECT count(*) FROM events e WHERE e.site_id = sites.id AND e.kind = 'tag_error' AND e.at >= sites.approved_at)`;

const CLAIMS = {
  // Discovered sites waiting for their home capture; fresh ones before retries,
  // which would otherwise always be first (they were discovered earliest).
  capture: { from: "discovered", to: "queued", order: "coalesce(attempts, 0), discovered_at, id" },
  // Captured sites waiting for the judge (left over from a budget cap or a run without a key).
  judge: { from: "captured", to: "judging", order: "captured_at, id" },
  // Approved sites whose subpages and tags never finished; given up after 3 tagging errors.
  finish: {
    from: "approved", to: "capturing", order: "approved_at, id",
    where: `NOT ${TAGGED_SINCE_APPROVAL} AND ${TAG_ERRORS_SINCE_APPROVAL} < 3`,
  },
};

// Claims the oldest site waiting for `kind` ("capture", "judge" or "finish"),
// skipping the ids in `exclude`. Returns the claimed row, or undefined.
// FOR UPDATE SKIP LOCKED keeps two concurrent claimers off the same row.
export function claimSite(kind, { exclude = [] } = {}) {
  const c = CLAIMS[kind];
  return get(`
    UPDATE sites SET status = @to, updated_at = @now
    WHERE status = @from AND id = (
      SELECT id FROM sites
      WHERE status = @from AND NOT (id = ANY(@exclude::text[])) ${c.where ? "AND " + c.where : ""}
      ORDER BY ${c.order} LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `, { from: c.from, to: c.to, now: now(), exclude });
}

// How many sites are waiting for each claim kind.
export async function queueCounts() {
  const entries = await Promise.all(Object.entries(CLAIMS).map(async ([kind, c]) => [
    kind,
    await value(`SELECT count(*) FROM sites WHERE status = @from ${c.where ? "AND " + c.where : ""}`, { from: c.from }),
  ]));
  return Object.fromEntries(entries);
}

// Moves a claimed site from one status to another only if it is still in `from`.
export function moveSite(id, from, to) {
  return get("UPDATE sites SET status = @to, updated_at = @now WHERE id = @id AND status = @from RETURNING *", { to, now: now(), id, from });
}

// Sites left in a transient status by a crashed run, untouched since `before`,
// go back to where they can be claimed again: queued → discovered, judging →
// captured, capturing → approved when it was finishing an approved site (its
// approval is newer than its home capture), else discovered. Returns the rows reset.
export function resetStaleClaims(before) {
  return all(`
    UPDATE sites SET updated_at = @now, status = CASE
      WHEN status = 'judging' THEN 'captured'
      WHEN status = 'capturing' AND approved_at IS NOT NULL AND approved_at = judged_at AND judged_at >= captured_at THEN 'approved'
      ELSE 'discovered' END
    WHERE status IN ('queued', 'capturing', 'judging') AND (updated_at IS NULL OR updated_at < @before)
    RETURNING id, domain, status
  `, { now: now(), before });
}

// Failed sites with fewer than `maxAttempts` capture attempts and no permanent
// error go back to discovered. Returns the rows re-queued.
export function requeueFailed(maxAttempts = 3) {
  return all(`
    UPDATE sites SET status = 'discovered', updated_at = @now
    WHERE status = 'failed' AND coalesce(attempts, 0) < @maxAttempts
      AND coalesce(last_error, '') NOT IN ('redirected_offsite', 'blocked', 'robots_disallowed')
      AND NOT EXISTS (SELECT 1 FROM optouts o WHERE o.domain = sites.domain AND ${OPTOUT_BLOCKS})
    RETURNING id, domain
  `, { now: now(), maxAttempts });
}

// Up to `limit` approved sites captured before `before` go back to discovered
// for a fresh capture and judgement. Returns the rows re-queued.
export function requeueOldCaptures(before, limit) {
  return all(`
    UPDATE sites SET status = 'discovered', attempts = 0, updated_at = @now
    WHERE id IN (
      SELECT id FROM sites WHERE status = 'approved' AND captured_at < @before ORDER BY captured_at LIMIT @limit
    )
    RETURNING id, domain
  `, { now: now(), before, limit });
}

export async function statusCounts() {
  return Object.fromEntries((await all("SELECT status, count(*) AS n FROM sites GROUP BY status")).map((r) => [r.status, r.n]));
}

// The newest error events, joined with the site's domain.
export function recentErrors(limit = 10) {
  return all(`
    SELECT e.at, e.kind, e.detail, s.domain, s.status FROM events e LEFT JOIN sites s ON s.id = e.site_id
    WHERE e.kind IN ('capture_failed', 'judge_failed', 'judge_error', 'tag_error', 'pipeline_error')
    ORDER BY e.id DESC LIMIT @limit
  `, { limit });
}

export function lastEvent(kind) {
  return get("SELECT * FROM events WHERE kind = @kind ORDER BY id DESC LIMIT 1", { kind });
}
