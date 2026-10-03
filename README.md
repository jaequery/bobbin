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

## Discover sites

Discovery fills the `sites` table with candidates (`status='discovered'`),
deduplicated by registrable domain and skipping galleries, social sites and
opted-out domains. It never downloads gallery images, only outbound URLs and
metadata, and it honors each gallery's robots.txt at 1 request per second.

```sh
npm run discover -- --source galleries --limit 200   # design galleries
npm run discover -- --source search                  # Brave Search (needs BRAVE_API_KEY)
npm run discover -- --only httpster --limit 20       # one adapter
npm run seed -- https://a.com https://b.com          # hand-picked sites
npm run seed -- --file seeds.example.txt
```

`--source` takes `galleries`, `search`, `seeds` or `all` (default); `seeds`
reads `seeds.txt`, else `seeds.example.txt`, unless `--file` is given. Search
runs at most `--max-queries` (default 30) queries per run.

| Adapter | Status |
| --- | --- |
| Awwwards (Sites of the Day) | working |
| One Page Love | working, genre mapped to industry |
| Httpster | working |
| Minimal Gallery | working |
| Godly | not adapted: redirects to recent.design, a client-rendered app |
| Land-book, Lapa Ninja | not adapted: 403 behind a bot challenge |
| SiteInspire | not adapted: 429 to plain requests |
| Brave Search | working; skipped with a notice when `BRAVE_API_KEY` is unset |

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
- `pipeline/discover/`: discovery adapters (`galleries/`, `search.js`, `seeds.js`), URL normalization and polite fetching
- `scripts/discover.js`, `scripts/seed.js`: the discovery CLIs
- `seeds.example.txt`: a starter list of well-designed sites
- `data/`: the local database and captures (git-ignored; `BOBBIN_DATA_DIR` moves it)
- `lib/bobbin.js`: hash routing, search and filters, rendering, the lightbox, and the procedural SVG screenshots

## URLs

State lives in the hash, so every view can be shared:
`#/apps`, `#/screens`, `#/app/<id>`, plus `?q=&platform=&pattern=&industry=`.
