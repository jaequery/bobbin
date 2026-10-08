-- Where each paged gallery adapter stopped reading (pipeline/discover/galleries/paged.js).
-- The next run reads page 1 for new entries, then resumes at `page`, so every run
-- reaches further into a gallery's archive instead of re-reading its first pages.
CREATE TABLE gallery_cursors (
  name       TEXT PRIMARY KEY,
  page       INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
