// Bobbin's local SQLite database: one shared connection plus small query helpers.
// Server-only: import it from Next server code or plain `node scripts/*.js`,
// never from client components (app/Bobbin.jsx, lib/bobbin.js).
//
// Rows come back with snake_case columns as stored. Helpers take camelCase
// fields. JSON columns (palette, detail) accept objects and are stored as text.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";

// Resolved at runtime; turbopackIgnore keeps Next from tracing the whole project for it.
export const dataDir = path.resolve(/*turbopackIgnore: true*/ process.env.BOBBIN_DATA_DIR || "data");
export const dbPath = path.join(dataDir, "bobbin.db");

function open() {
  mkdirSync(dataDir, { recursive: true });
  const conn = new Database(dbPath);
  // Set first so a concurrent opener waits instead of failing the WAL switch.
  conn.pragma("busy_timeout = 5000");
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  return conn;
}

// Opened on first use, not at import: `next build` loads every route module to
// collect page data, and must not create or lock the database while doing so.
// One connection is reused across Next dev hot reloads.
const connection = () => (globalThis.__bobbinDb ??= open());
export const db = new Proxy({}, {
  get(_, key) {
    const conn = connection();
    const value = conn[key];
    return typeof value === "function" ? value.bind(conn) : value;
  },
});

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
export function upsertSite(fields) {
  const domain = normalizeDomain(fields.domain);
  const cols = {};
  for (const [key, col] of Object.entries(SITE_FIELDS)) {
    if (fields[key] !== undefined) cols[col] = col === "palette" ? json(fields[key]) : fields[key];
  }
  cols.updated_at = now();

  return db.transaction(() => {
    const existing = getSiteByDomain(domain);
    if (existing) {
      const sets = Object.keys(cols).map((c) => `${c} = @${c}`).join(", ");
      db.prepare(`UPDATE sites SET ${sets} WHERE id = @id`).run({ ...cols, id: existing.id });
      return getSite(existing.id);
    }
    const row = { id: randomUUID(), domain, discovered_at: now(), ...cols };
    const names = Object.keys(row);
    db.prepare(`INSERT INTO sites (${names.join(", ")}) VALUES (${names.map((c) => "@" + c).join(", ")})`).run(row);
    return getSite(row.id);
  })();
}

export function getSite(id) {
  return db.prepare("SELECT * FROM sites WHERE id = ?").get(id);
}

export function getSiteByDomain(domain) {
  return db.prepare("SELECT * FROM sites WHERE domain = ?").get(normalizeDomain(domain));
}

export function setSiteStatus(id, status) {
  db.prepare("UPDATE sites SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), id);
  return getSite(id);
}

// Keyset pagination by id: pass the returned `next` as `cursor` for the next page.
export function listSites({ status, limit = 50, cursor } = {}) {
  const where = [];
  const params = { limit };
  if (status) { where.push("status = @status"); params.status = status; }
  if (cursor) { where.push("id > @cursor"); params.cursor = cursor; }
  const items = db
    .prepare(`SELECT * FROM sites ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id LIMIT @limit`)
    .all(params);
  return { items, next: items.length === limit ? items[items.length - 1].id : null };
}

/* ---------- Pages, screens, sections ---------- */

// One row per (site, path): capturing the same path again updates it.
export function insertPage({ siteId, url = null, path: pagePath, pattern = null, title = null, capturedAt = now() }) {
  return db.prepare(`
    INSERT INTO pages (id, site_id, url, path, pattern, title, captured_at)
    VALUES (@id, @siteId, @url, @path, @pattern, @title, @capturedAt)
    ON CONFLICT (site_id, path) DO UPDATE SET
      url = excluded.url, pattern = excluded.pattern, title = excluded.title, captured_at = excluded.captured_at
    RETURNING *
  `).get({ id: randomUUID(), siteId, url, path: pagePath, pattern, title, capturedAt });
}

export function insertScreen({
  siteId, pageId = null, platform, width = null, height = null,
  fullPath = null, lgPath = null, smPath = null, dominant = null, palette = null, hueBucket = null, theme = null, capturedAt = now(),
}) {
  return db.prepare(`
    INSERT INTO screens (id, site_id, page_id, platform, width, height, full_path, lg_path, sm_path, dominant, palette, hue_bucket, theme, captured_at)
    VALUES (@id, @siteId, @pageId, @platform, @width, @height, @fullPath, @lgPath, @smPath, @dominant, @palette, @hueBucket, @theme, @capturedAt)
    RETURNING *
  `).get({ id: randomUUID(), siteId, pageId, platform, width, height, fullPath, lgPath, smPath, dominant, palette: json(palette), hueBucket, theme, capturedAt });
}

export function insertSection({ id = randomUUID(), screenId, siteId, type = null, y = null, height = null, imgPath = null, smPath = null }) {
  return db.prepare(`
    INSERT INTO sections (id, screen_id, site_id, type, y, height, img_path, sm_path)
    VALUES (@id, @screenId, @siteId, @type, @y, @height, @imgPath, @smPath)
    RETURNING *
  `).get({ id, screenId, siteId, type, y, height, imgPath, smPath });
}

export function listPages(siteId) {
  return db.prepare("SELECT * FROM pages WHERE site_id = ? ORDER BY path").all(siteId);
}

// Deletes a page with its screens and sections. Returns the image paths to remove.
export function deletePage(pageId) {
  return db.transaction(() => {
    const paths = deleteScreensForPage(pageId);
    db.prepare("DELETE FROM pages WHERE id = ?").run(pageId);
    return paths;
  })();
}

// Deletes a page's screens (and, by cascade, their sections) before a re-capture.
// Returns the image paths those rows pointed at so the caller can remove the files.
export function deleteScreensForPage(pageId) {
  return db.transaction(() => {
    const screens = db.prepare("SELECT id, full_path, lg_path, sm_path FROM screens WHERE page_id = ?").all(pageId);
    const paths = screens.flatMap((s) => [s.full_path, s.lg_path, s.sm_path]);
    for (const s of screens) {
      const sections = db.prepare("SELECT img_path, sm_path FROM sections WHERE screen_id = ?").all(s.id);
      paths.push(...sections.flatMap((x) => [x.img_path, x.sm_path]));
    }
    db.prepare("DELETE FROM screens WHERE page_id = ?").run(pageId);
    return paths.filter(Boolean);
  })();
}

// Screens joined with their page pattern and site fields. Every filter is optional.
export function listScreens({ siteId, platform, pattern, industry, status, limit = 48, offset = 0 } = {}) {
  const where = [];
  const params = { limit, offset };
  const add = (sql, key, value) => { if (value) { where.push(sql); params[key] = value; } };
  add("sc.site_id = @siteId", "siteId", siteId);
  add("sc.platform = @platform", "platform", platform);
  add("p.pattern = @pattern", "pattern", pattern);
  add("s.industry = @industry", "industry", industry);
  add("s.status = @status", "status", status);
  return db.prepare(`
    SELECT sc.*, p.pattern, p.path, p.title AS page_title,
           s.domain, s.name AS site_name, s.industry, s.status AS site_status
    FROM screens sc
    JOIN sites s ON s.id = sc.site_id
    LEFT JOIN pages p ON p.id = sc.page_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY sc.captured_at DESC, sc.id
    LIMIT @limit OFFSET @offset
  `).all(params);
}

/* ---------- Events and opt-outs ---------- */

export function recordEvent(siteId, kind, detail = null) {
  db.prepare("INSERT INTO events (site_id, kind, detail, at) VALUES (?, ?, ?, ?)").run(siteId ?? null, kind, json(detail), now());
}

// Opt-out lifecycle: a removal request starts 'pending', and the admin marks it
// 'approved' (the site's files and rows are deleted) or 'dismissed'. Pending and
// approved rows hide the domain and block capture; a dismissed one does neither.
export const OPTOUT_STATUSES = Object.freeze(["pending", "approved", "dismissed"]);
// SQL condition on an optouts row (alias `o`) that blocks its domain.
export const OPTOUT_BLOCKS = "coalesce(o.status, 'pending') <> 'dismissed'";

export function isOptedOut(domain) {
  return !!db.prepare(`SELECT 1 FROM optouts o WHERE o.domain = ? AND ${OPTOUT_BLOCKS}`).get(normalizeDomain(domain));
}

export function getOptout(domain) {
  return db.prepare("SELECT * FROM optouts WHERE domain = ?").get(normalizeDomain(domain));
}

// Records a request. A new request for a dismissed domain reopens it as pending.
export function addOptout({ domain, email = null, reason = null }) {
  const d = normalizeDomain(domain);
  db.prepare(`
    INSERT INTO optouts (domain, email, reason, created_at, status) VALUES (?, ?, ?, ?, 'pending')
    ON CONFLICT (domain) DO UPDATE SET status = 'pending', email = excluded.email, reason = excluded.reason, created_at = excluded.created_at
    WHERE optouts.status = 'dismissed'
  `).run(d, email, reason, now());
  return getOptout(d);
}

export function setOptoutStatus(domain, status) {
  return db.prepare("UPDATE optouts SET status = ? WHERE domain = ? RETURNING *").get(status, normalizeDomain(domain));
}

export function listOptouts() {
  return db.prepare(`
    SELECT o.*, s.id AS site_id, s.status AS site_status FROM optouts o LEFT JOIN sites s ON s.domain = o.domain
    ORDER BY (o.status = 'pending') DESC, o.created_at DESC
  `).all();
}

// Deletes a site's row; pages, screens and sections go with it by cascade.
// The caller removes data/shots/<id>/.
export function deleteSite(id) {
  return db.prepare("DELETE FROM sites WHERE id = ?").run(id).changes > 0;
}

/* ---------- Pipeline queue ---------- */

// The `sites` table is the pipeline's queue. A claim moves one site out of a
// resumable status into a transient one in a single UPDATE, so two pipeline
// processes can never take the same site.
const TAGGED_SINCE_APPROVAL = `EXISTS (SELECT 1 FROM events e WHERE e.site_id = sites.id AND e.kind = 'tagged' AND e.at >= sites.approved_at)`;
const TAG_ERRORS_SINCE_APPROVAL = `(SELECT count(*) FROM events e WHERE e.site_id = sites.id AND e.kind = 'tag_error' AND e.at >= sites.approved_at)`;

const CLAIMS = {
  // Discovered sites waiting for their home capture.
  capture: { from: "discovered", to: "queued", order: "discovered_at, id" },
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
export function claimSite(kind, { exclude = [] } = {}) {
  const c = CLAIMS[kind];
  return db.prepare(`
    UPDATE sites SET status = @to, updated_at = @now
    WHERE status = @from AND id = (
      SELECT id FROM sites
      WHERE status = @from AND id NOT IN (SELECT value FROM json_each(@exclude)) ${c.where ? "AND " + c.where : ""}
      ORDER BY ${c.order} LIMIT 1
    )
    RETURNING *
  `).get({ from: c.from, to: c.to, now: now(), exclude: JSON.stringify(exclude) });
}

// How many sites are waiting for each claim kind.
export function queueCounts() {
  return Object.fromEntries(Object.entries(CLAIMS).map(([kind, c]) => [
    kind,
    db.prepare(`SELECT count(*) FROM sites WHERE status = ? ${c.where ? "AND " + c.where : ""}`).pluck().get(c.from),
  ]));
}

// Moves a claimed site from one status to another only if it is still in `from`.
export function moveSite(id, from, to) {
  return db.prepare("UPDATE sites SET status = ?, updated_at = ? WHERE id = ? AND status = ? RETURNING *").get(to, now(), id, from);
}

// Sites left in a transient status by a crashed run, untouched since `before`,
// go back to where they can be claimed again: queued → discovered, judging →
// captured, capturing → approved when it was finishing an approved site (its
// approval is newer than its home capture), else discovered. Returns the rows reset.
export function resetStaleClaims(before) {
  return db.prepare(`
    UPDATE sites SET updated_at = @now, status = CASE
      WHEN status = 'judging' THEN 'captured'
      WHEN status = 'capturing' AND approved_at IS NOT NULL AND approved_at = judged_at AND judged_at >= captured_at THEN 'approved'
      ELSE 'discovered' END
    WHERE status IN ('queued', 'capturing', 'judging') AND (updated_at IS NULL OR updated_at < @before)
    RETURNING id, domain, status
  `).all({ now: now(), before });
}

// Failed sites with fewer than `maxAttempts` capture attempts and no permanent
// error go back to discovered. Returns the rows re-queued.
export function requeueFailed(maxAttempts = 3) {
  return db.prepare(`
    UPDATE sites SET status = 'discovered', updated_at = @now
    WHERE status = 'failed' AND coalesce(attempts, 0) < @maxAttempts
      AND coalesce(last_error, '') NOT IN ('redirected_offsite', 'blocked', 'robots_disallowed')
      AND NOT EXISTS (SELECT 1 FROM optouts o WHERE o.domain = sites.domain AND ${OPTOUT_BLOCKS})
    RETURNING id, domain
  `).all({ now: now(), maxAttempts });
}

// Up to `limit` approved sites captured before `before` go back to discovered
// for a fresh capture and judgement. Returns the rows re-queued.
export function requeueOldCaptures(before, limit) {
  return db.prepare(`
    UPDATE sites SET status = 'discovered', attempts = 0, updated_at = @now
    WHERE id IN (
      SELECT id FROM sites WHERE status = 'approved' AND captured_at < @before ORDER BY captured_at LIMIT @limit
    )
    RETURNING id, domain
  `).all({ now: now(), before, limit });
}

export function statusCounts() {
  return Object.fromEntries(db.prepare("SELECT status, count(*) AS n FROM sites GROUP BY status").all().map((r) => [r.status, r.n]));
}

// The newest error events, joined with the site's domain.
export function recentErrors(limit = 10) {
  return db.prepare(`
    SELECT e.at, e.kind, e.detail, s.domain, s.status FROM events e LEFT JOIN sites s ON s.id = e.site_id
    WHERE e.kind IN ('capture_failed', 'judge_failed', 'judge_error', 'tag_error', 'pipeline_error')
    ORDER BY e.id DESC LIMIT ?
  `).all(limit);
}

export function lastEvent(kind) {
  return db.prepare("SELECT * FROM events WHERE kind = ? ORDER BY id DESC LIMIT 1").get(kind);
}
