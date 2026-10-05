-- Full-text search and color/theme filters.
--
-- search_idx holds one row per page: a weighted tsvector over the site's own
-- fields plus the page's pattern, title and the section types on its screens.
-- lib/search.js rebuilds a site's rows (reindexSite) after capture, judging and
-- tagging; `npm run search:reindex` rebuilds them all.
CREATE TABLE search_idx (
  page_id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  vec     TSVECTOR NOT NULL
);
CREATE INDEX search_idx_vec ON search_idx USING GIN (vec);
CREATE INDEX search_idx_site ON search_idx(site_id);

-- From lib/color.js: a COLOR_BUCKETS id and 'light' or 'dark'. A site matches
-- a color or theme through its screens. Filled by capture and `npm run color:backfill`.
ALTER TABLE screens ADD COLUMN hue_bucket TEXT;
ALTER TABLE screens ADD COLUMN theme TEXT;

CREATE INDEX screens_color ON screens(hue_bucket, theme);
CREATE INDEX screens_page ON screens(page_id);
CREATE INDEX sections_screen ON sections(screen_id);
CREATE INDEX sites_country ON sites(country);
