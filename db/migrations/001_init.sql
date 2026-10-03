-- Bobbin's initial schema. Ids are strings generated in JS (crypto.randomUUID()).
-- Timestamps are ISO-8601 text; JSON columns hold JSON text.

CREATE TABLE sites (
  id            TEXT PRIMARY KEY,
  domain        TEXT NOT NULL UNIQUE,
  url           TEXT,
  name          TEXT,
  tagline       TEXT,
  description   TEXT,
  industry      TEXT,
  country       TEXT,
  language      TEXT,
  status        TEXT NOT NULL DEFAULT 'discovered',
  quality       REAL,
  quality_notes TEXT,
  source        TEXT,
  source_ref    TEXT,
  tone_a        TEXT,
  tone_b        TEXT,
  palette       JSON,
  discovered_at TEXT,
  captured_at   TEXT,
  judged_at     TEXT,
  approved_at   TEXT,
  updated_at    TEXT,
  attempts      INTEGER DEFAULT 0,
  last_error    TEXT
);

CREATE TABLE pages (
  id          TEXT PRIMARY KEY,
  site_id     TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  url         TEXT,
  path        TEXT,
  pattern     TEXT,
  title       TEXT,
  captured_at TEXT,
  UNIQUE (site_id, path)
);

CREATE TABLE screens (
  id          TEXT PRIMARY KEY,
  site_id     TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  page_id     TEXT REFERENCES pages(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL CHECK (platform IN ('desktop', 'mobile')),
  width       INTEGER,
  height      INTEGER,
  full_path   TEXT,
  lg_path     TEXT,
  sm_path     TEXT,
  dominant    TEXT,
  palette     JSON,
  captured_at TEXT
);

CREATE TABLE sections (
  id         TEXT PRIMARY KEY,
  screen_id  TEXT NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  site_id    TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  type       TEXT,
  y          INTEGER,
  height     INTEGER,
  img_path   TEXT,
  sm_path    TEXT
);

CREATE TABLE optouts (
  domain     TEXT PRIMARY KEY,
  email      TEXT,
  reason     TEXT,
  created_at TEXT,
  status     TEXT DEFAULT 'pending'
);

-- Pipeline audit log.
CREATE TABLE events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id TEXT,
  kind    TEXT NOT NULL,
  detail  JSON,
  at      TEXT NOT NULL
);

CREATE INDEX sites_status ON sites(status);
CREATE INDEX sites_industry ON sites(industry);
CREATE INDEX screens_site ON screens(site_id);
CREATE INDEX screens_platform ON screens(platform);
CREATE INDEX pages_pattern ON pages(pattern);
CREATE INDEX sections_type ON sections(type);
CREATE INDEX events_site ON events(site_id);
