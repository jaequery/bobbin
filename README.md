# Bobbin

A public design-inspiration library of real, well-designed websites. A local
pipeline discovers sites, captures them at desktop and mobile widths, and
publishes the ones that pass a quality gate. Visitors browse sites and their
screens, search, and filter by platform, page pattern and industry. There is no
sign-in and nothing is saved.

Every captured site is shown with a link to its source domain. The pipeline
honors robots.txt, never presents a site's logo as Bobbin's own, and skips any
domain that has opted out. The browse UI still reads the placeholder library in
`lib/data.js` until it is switched to the database.

## Run it

Bobbin is a Next.js app (App Router). Node 20.9 or newer.

```sh
npm install
cp .env.example .env         # then fill in the keys you need
npm run db:migrate           # creates or upgrades data/bobbin.db
npm run dev                  # http://localhost:3000
npm run build && npm start   # production build
```

## Capture a site

The capture engine drives a local headless Chromium through Playwright. Install
the browser once (about 150 MB):

```sh
npx playwright install chromium
npm run capture -- https://example.com              # home page only
npm run capture -- https://example.com --subpages   # plus up to 8 internal pages
npm run capture -- https://example.com --headed     # watch the browser
```

Each page is shot at desktop (1440) and mobile (390) widths. Images land in
`data/shots/<siteId>/` as WebP: `<page>-<platform>-full.webp` (the whole page,
capped at 12000 css px), `-lg` and `-sm` top-of-page thumbnails, and
`sections/<sectionId>{,-sm}.webp` crops. Rows go into `pages`, `screens` and
`sections`. Opted-out domains and URLs disallowed by robots.txt are skipped and
logged in `events`.

## Files

- `app/layout.jsx`: the document, metadata and font
- `app/page.jsx`: the page shell
- `app/Bobbin.jsx`: client component that mounts the renderer
- `app/styles.css`: design tokens and components
- `styles.md`: the style guide those tokens come from
- `lib/data.js`: the placeholder library the UI still reads (to be replaced by the database)
- `lib/db.js`: the SQLite connection and query helpers (server only)
- `lib/taxonomy.js`: platforms, page patterns, section types, industries and site statuses
- `db/migrations/*.sql`: the schema, applied in order by `scripts/db-migrate.js`
- `data/`: the local database and captures (git-ignored; `BOBBIN_DATA_DIR` moves it)
- `pipeline/*.js`: the capture engine (browser, page prep, robots/opt-out checks, sections, subpage links); `scripts/capture.js` is its CLI
- `lib/bobbin.js`: hash routing, search and filters, rendering, the lightbox, and the procedural SVG screenshots

## URLs

State lives in the hash, so every view can be shared:
`#/apps`, `#/screens`, `#/app/<id>`, plus `?q=&platform=&pattern=&industry=`.
