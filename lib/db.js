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

export const dataDir = path.resolve(process.env.BOBBIN_DATA_DIR || "data");
export const dbPath = path.join(dataDir, "bobbin.db");

function open() {
  mkdirSync(dataDir, { recursive: true });
  const conn = new Database(dbPath);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.pragma("busy_timeout = 5000");
  return conn;
}

// Reuse one connection across Next dev hot reloads.
export const db = (globalThis.__bobbinDb ??= open());

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
  fullPath = null, lgPath = null, smPath = null, dominant = null, palette = null, capturedAt = now(),
}) {
  return db.prepare(`
    INSERT INTO screens (id, site_id, page_id, platform, width, height, full_path, lg_path, sm_path, dominant, palette, captured_at)
    VALUES (@id, @siteId, @pageId, @platform, @width, @height, @fullPath, @lgPath, @smPath, @dominant, @palette, @capturedAt)
    RETURNING *
  `).get({ id: randomUUID(), siteId, pageId, platform, width, height, fullPath, lgPath, smPath, dominant, palette: json(palette), capturedAt });
}

export function insertSection({ screenId, siteId, type = null, y = null, height = null, imgPath = null, smPath = null }) {
  return db.prepare(`
    INSERT INTO sections (id, screen_id, site_id, type, y, height, img_path, sm_path)
    VALUES (@id, @screenId, @siteId, @type, @y, @height, @imgPath, @smPath)
    RETURNING *
  `).get({ id: randomUUID(), screenId, siteId, type, y, height, imgPath, smPath });
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

// Any opt-out row counts, including a pending request.
export function isOptedOut(domain) {
  return !!db.prepare("SELECT 1 FROM optouts WHERE domain = ?").get(normalizeDomain(domain));
}

export function addOptout({ domain, email = null, reason = null }) {
  const d = normalizeDomain(domain);
  db.prepare("INSERT INTO optouts (domain, email, reason, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (domain) DO NOTHING")
    .run(d, email, reason, now());
  return db.prepare("SELECT * FROM optouts WHERE domain = ?").get(d);
}
