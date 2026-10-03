-- Full-text search and color/theme filters.
--
-- search_idx holds one row per page: the site's own fields plus the page's
-- pattern, title and the section types on its screens. lib/search.js rebuilds a
-- site's rows (reindexSite) after capture, judging and tagging; `npm run
-- search:reindex` rebuilds them all.
CREATE VIRTUAL TABLE search_idx USING fts5(
  site_id UNINDEXED,
  page_id UNINDEXED,
  name, domain, tagline, description, industry, country, pattern, title, sections,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3'
);

-- From lib/color.js: a COLOR_BUCKETS id and 'light' or 'dark'. A site matches
-- a color or theme through its screens. Filled by capture and `npm run color:backfill`.
ALTER TABLE screens ADD COLUMN hue_bucket TEXT;
ALTER TABLE screens ADD COLUMN theme TEXT;

CREATE INDEX screens_color ON screens(hue_bucket, theme);
CREATE INDEX screens_page ON screens(page_id);
CREATE INDEX sections_screen ON sections(screen_id);
CREATE INDEX sites_country ON sites(country);
