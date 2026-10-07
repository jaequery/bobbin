# Jethro

A public design-inspiration library of real, well-designed websites. A local
pipeline discovers sites, captures them at desktop and mobile widths, and
publishes the ones that pass a quality gate. Visitors browse sites and their
screens, search, and filter by platform, page pattern, industry, color, theme and country. There is no
sign-in and nothing is saved.

Every captured site is shown with a link to its source domain. The pipeline
honors robots.txt, never presents a site's logo as Jethro's own, and skips any
domain that has opted out. The browse UI reads the database through the route
handlers below, and shows only `approved` sites whose domain is not in
`optouts`.

## Run it

Jethro is a Next.js app (App Router). Node 20.9 or newer.

```sh
npm install
vercel link && vercel env pull  # DATABASE_URL (Neon) and BLOB_READ_WRITE_TOKEN into .env.local
cp .env.example .env         # then fill in the keys you need
npm run db:migrate           # creates or upgrades the Postgres schema
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

`--limit` caps the new sites a run adds. Sites already in the library do not
count toward it, so each run reads past the gallery entries earlier runs took,
up to ten times the limit in candidates. Refero and Site of Sites are read from
their sitemaps, and they, Admire the Web and Typewolf skip the detail pages already stored
as a site's source.

| Adapter | Status |
| --- | --- |
| Awwwards (Sites of the Day) | working |
| CSS Design Awards (website gallery) | working |
| Refero Styles | working, one style page fetched per new site |
| One Page Love | working, genre mapped to industry |
| Curated | working |
| Httpster | working |
| CSS Nectar | working |
| Minimal Gallery | working |
| Dark Mode Design | working |
| Site of Sites | working, read from its sitemap newest first, one page fetched per new site |
| Admire the Web | working, one detail page fetched per new site |
| Best Website Gallery | working |
| Typewolf (Site of the Day) | working, one detail page fetched per new site |
| Hover States | working, read from its archive data newest first |
| Siiimple | working |
| Landing Love | working, category mapped to industry |
| ecomm.design | working, every site tagged E-commerce |
| Godly | not adapted: redirects to recent.design, a client-rendered app |
| The FWA | not adapted: client-rendered |
| Land-book, Lapa Ninja, Web Design Inspiration, Saaspo, Maxibestof | not adapted: 403 behind a bot challenge |
| SiteInspire | not adapted: 403/429 to plain requests |
| SaaS Landing Page | not adapted: the site link is only on each detail page |
| Brave Search | working; skipped with a notice when `BRAVE_API_KEY` is unset |

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
the private Vercel Blob store under `shots/<siteId>/` (or `data/shots/<siteId>/`
when `BLOB_READ_WRITE_TOKEN` is unset) as WebP: `<page>-<platform>-full.webp` (the whole page,
capped at 12000 css px), `-lg` and `-sm` top-of-page thumbnails, and
`sections/<sectionId>{,-sm}.webp` crops. Rows go into `pages`, `screens` and
`sections`. Opted-out domains and URLs disallowed by robots.txt are skipped and
logged in `events`.

## Judge and tag

Claude vision decides which captured sites make it into Jethro. Judging sends
only the two home-page folds (the desktop and mobile `-lg` thumbnails) with the
domain and page title, and gets back a 1–10 quality score with per-dimension
scores and reasons, plus a name, an original tagline and description, an
industry, a country and a language. A site scoring at least
`JETHRO_MIN_QUALITY` (default 7) becomes `approved`, anything lower `rejected`.
A capture that does not show the real site (blank, error page, bot challenge,
a cookie wall over most of the fold) becomes `failed` with
`last_error='bad_capture'` so it can be captured again. Approved sites are then
tagged: each page gets a page pattern and every section crop a section type,
from `lib/taxonomy.js`.

```sh
npm run judge -- stripe.com                    # judge one site (id or domain), tag it if approved
npm run judge -- --dry-run stripe.com          # print the judgement as JSON, write nothing
npm run judge -- --all-captured --limit 15     # every site with status 'captured'
npm run judge -- --retag <siteId|domain>       # re-run tagging only
```

Calls go through Vercel AI Gateway, authenticated by `AI_GATEWAY_API_KEY` or
the Vercel OIDC token (automatic on Vercel; `vercel env pull` puts a 12-hour
one in `.env.local`). A set `ANTHROPIC_API_KEY` calls Anthropic directly
instead. With none of these the CLI exits 1. `JETHRO_JUDGE_MODEL` picks the
model (default `claude-sonnet-5-5`, sent to the gateway as
`anthropic/claude-sonnet-5.5`). Token use and an estimated cost
are printed as it runs and logged in `events`. To re-judge a site, set its
status back to `captured`.

## Run the whole pipeline

`npm run pipeline` takes sites through discovered → captured (home page) →
judged → (if approved) subpages captured → tagged, three sites at a time and
one page at a time per domain. Postgres is the queue: each site is claimed with
one atomic update, so a crashed or overlapping run never processes a site
twice, and the next run picks up where the last one stopped.

```sh
npm run pipeline -- --discover --limit 50     # discover first, then advance up to 50 sites
npm run pipeline -- --limit 10 --max-judge 20 # no discovery, at most 20 AI calls
npm run pipeline -- --dry-run                 # show what is waiting, change nothing
npm run pipeline -- --watch 6h                # run again every 6 hours until Ctrl-C
npm run pipeline:status                       # sites per status and the last 10 errors
```

| Flag | Default | |
| --- | --- | --- |
| `--discover` | off | run discovery before claiming sites |
| `--sources` | `galleries,search` | discovery sources (`galleries`, `search`, `seeds`) |
| `--discover-limit` | 200 | new sites discovery adds |
| `--limit` | 25 | sites advanced this run |
| `--concurrency` | 3 | sites in parallel |
| `--max-judge` | 100 | AI calls (judge + tag) this run |
| `--recapture-older-than` | off | re-queue approved sites captured longer ago, e.g. `90d` |
| `--retry-failed` | off | re-queue failed sites with fewer than 3 attempts |
| `--prune-rejected` | off | delete a rejected site's screenshots |
| `--watch` | off | repeat on an interval, e.g. `6h` |
| `--dry-run` | off | print the queue and exit |

Each run works on unfinished approved sites first, then captured sites waiting
for the judge, then discovered sites. Judging a site reserves two AI calls
(judge and tag); once `--max-judge` is used up, newly captured sites stay
`captured` for the next run. Without AI credentials the pipeline only
captures. Approved sites stay hidden (`capturing`) until their subpages and
tags are in. It stops claiming when less than 2 GB is free, and restarts the
browser every 50 sites.

Ctrl-C once stops claiming and lets in-flight sites finish; a second Ctrl-C
quits at once, and sites it held go back to the queue on any run started 30
minutes later. Every transition is printed (`[3/10] stripe.com captured 64.8s`),
appended to `data/logs/pipeline-YYYY-MM-DD.jsonl` and recorded in `events`; a
summary (counts, AI calls, estimated cost, disk added) ends each run.

### Running nightly

With cron (`crontab -e`), 3 am every night:

```
0 3 * * * cd /path/to/jethro && npm run pipeline -- --discover --limit 100 >> data/logs/cron.log 2>&1
```

cron and launchd start with a minimal `PATH`; if `npm` is not found, use its
full path (`which npm`). On macOS, launchd also runs a missed job after the Mac
wakes. Save as `~/Library/LaunchAgents/com.jethro.pipeline.plist`, then
`launchctl load ~/Library/LaunchAgents/com.jethro.pipeline.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.jethro.pipeline</string>
  <key>WorkingDirectory</key><string>/path/to/jethro</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string><string>-lc</string>
    <string>npm run pipeline -- --discover --limit 100</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/path/to/jethro/data/logs/cron.log</string>
  <key>StandardErrorPath</key><string>/path/to/jethro/data/logs/cron.log</string>
</dict>
</plist>
```

100 sites a night is a suggested starting point; pick the limit and schedule
that suit your machine and AI budget.

### On Vercel Cron

Production also runs the pipeline itself: `vercel.json` calls
`/api/cron/pipeline` every 2 hours. Each run discovers more sites when fewer
than 12 wait for capture, then takes up to 4 sites, one at a time and with at
most 4 subpages each, through the pipeline with
serverless Chromium (`@sparticuz/chromium`) and the judge on AI Gateway via
OIDC. It stops claiming after 5 minutes so an in-flight site finishes within the
800-second limit. The route answers 404 unless called with
`Authorization: Bearer $CRON_SECRET`. On Vercel `JETHRO_DATA_DIR` is
`/tmp/jethro` (logs only); run logs are in the function logs and `events`.
Change the batch in `app/api/cron/pipeline/route.js` and the schedule in
`vercel.json`.

## Browse the library

`npm run dev` serves the library from Postgres (`DATABASE_URL`) and the shots
store. Before
any site is judged, `JETHRO_SHOW_UNJUDGED=1 npm run dev` also shows `captured`
sites, so a fresh capture can be browsed without an API key.

| Route | Returns |
| --- | --- |
| `GET /api/library/meta` | the taxonomy with public counts per platform, pattern, section type, industry, color and theme, plus the countries that have public sites (with their region) |
| `GET /api/sites?q&platform&pattern&section&industry&color&theme&country&cursor&limit=24` | sites with a desktop and a mobile cover screen |
| `GET /api/sites/<id>` | one site with its pages, screens and sections (404 unless public) |
| `GET /api/screens?…same filters…&cursor&limit=36` | page screenshots |
| `GET /api/sections?type&…same filters…&cursor&limit=36` | section crops |
| `GET /api/suggest?q` | up to 8 suggestions for the search box: page patterns, section types, industries, then sites |
| `GET /shots/<siteId>/<file>.webp` | a captured image of a public site, cached as immutable (any site for the admin, uncached) |

Lists answer `{ data: { items, total, next } }`; pass `next` back as `cursor`
for the following page. Unknown filter values are ignored.

`q` searches a Postgres full-text index (`search_idx`, one weighted `tsvector`
per page) with every word as a prefix, ranked by `ts_rank` with site name and
domain weighted highest.
One-character and CJK queries fall back to substring matching. The capture
engine, judge and tagger keep the index current; `npm run search:reindex`
rebuilds it, and the server rebuilds it once by itself when it holds fewer rows
than there are pages. A screen's `color` (red, orange, yellow, green, teal,
blue, purple, pink, brown, black, white or gray) and `theme` (light or dark)
come from its dominant color and palette (`lib/color.js`); capture sets them,
and `npm run color:backfill` fills screens captured before they existed.
`country` is an ISO 3166-1 alpha-2 code from the judge.

```sh
npm run db:migrate        # adds the search index and color columns
npm run color:backfill    # -- --all recomputes every screen
npm run search:reindex
```

## Curate locally (admin)

`JETHRO_ADMIN=1 npm run dev`, then open http://localhost:3000/admin. The admin
lists sites by status (Queue: captured, failed and in-flight; Discovered;
Approved; Rejected) with home thumbnails, score and the judge's reasons. Per
site you can approve or reject, edit name, tagline, industry and country, retag
each page's pattern and each section's type, re-capture, re-judge (needs
`ANTHROPIC_API_KEY`) or delete the site and its shots. "Add seeds"
takes URLs one per line, and "Removal requests" processes opt-outs.

Re-capture and re-judge run as background jobs inside the server process, one
at a time, and are lost on restart; the page polls `GET /api/admin/jobs`. A
re-captured site keeps its approved or rejected status (its tags fall back to
the capture engine's guesses until it is re-judged or retagged). A site a
pipeline run holds (`queued`, `capturing`, `judging`) is refused as busy.

The admin answers 404 unless **both** `JETHRO_ADMIN=1` is set and the request
comes over loopback: the socket address (stamped by `next.config.mjs`, so a
client-sent `X-Forwarded-For` cannot fake it), the `Host` header and any
`Origin` must be `localhost`, `127.0.0.1` or `::1`. Never set `JETHRO_ADMIN` on
a hosted deployment; the guard is the only protection, there are no accounts.

| Route | Does |
| --- | --- |
| `GET /api/admin/sites?tab=queue\|discovered\|approved\|rejected&q` | sites in a tab, plus per-tab counts |
| `GET/PATCH/DELETE /api/admin/sites/<id>` | one site with pages, screens, sections and events / edit (`name`, `tagline`, `industry`, `country`, `status`, `pages: [{id, pattern}]`, `sections: [{id, type}]`, enums checked against `lib/taxonomy.js`) / delete |
| `POST /api/admin/sites/<id>/recapture`, `…/rejudge` | queue a job (409 when busy) |
| `GET /api/admin/jobs` | recent jobs and their state |
| `POST /api/admin/seeds` | `{ urls }`, one per line, added as `discovered` |
| `GET/PATCH /api/admin/optouts` | removal requests / `{ domain, status: "approved" \| "dismissed" }` |

## Removal requests

"Request removal" in the About dialog posts `{ domain, email, reason }` to
`POST /api/removal` (5 posts per hour per IP, in memory). The domain (any URL
or host, reduced to its registrable domain) is stored in `optouts` as
`pending`: it vanishes from every public API and image at once, and discovery,
seeding and capture refuse it. The answer is the same whether or not the
domain is in the library. In the admin, **Approve removal** deletes the site's
rows and images and keeps blocking the domain; **Dismiss** lets it back into
the library and the pipeline. A new request for a dismissed domain reopens it.

## Files

- `app/layout.jsx`: the document, metadata and font
- `app/page.jsx`: the page shell
- `app/Jethro.jsx`: client component that mounts the renderer
- `app/styles.css`: design tokens and components
- `styles.md`: the style guide those tokens come from
- `lib/db.js`: the Postgres pool and query helpers (server only)
- `lib/shots.js`: reading, writing and deleting captured images (Vercel Blob, or local disk without a token)
- `lib/queries.js`: the public browse queries (filters, keyset pagination, public-site rule) behind the API (server only)
- `lib/api.js`: request parsing and JSON responses shared by the route handlers
- `app/api/**/route.js`, `app/shots/[...path]/route.js`: the browse API and the image server
- `lib/taxonomy.js`: platforms, page patterns, section types, industries, color buckets, themes and site statuses
- `lib/search.js`: the full-text index (reindexing and safe tsquery building); `scripts/search-reindex.js` is its CLI
- `lib/color.js`: color bucket and theme rules; `scripts/color-backfill.js` applies them to stored screens
- `lib/regions.js`: country codes grouped by region for the Country filter
- `db/migrations/*.sql`: the schema, applied in order by `scripts/db-migrate.js`
- `pipeline/discover/`: discovery adapters (`galleries/`, `search.js`, `seeds.js`), URL normalization and polite fetching
- `scripts/discover.js`, `scripts/seed.js`: the discovery CLIs
- `seeds.example.txt`: a starter list of well-designed sites
- `data/`: local pipeline logs, and captures when there is no Blob token (git-ignored; `JETHRO_DATA_DIR` moves it)
- `scripts/import-sqlite.js`: one-off copy of an old SQLite library and its `data/shots` into Postgres and Blob
- `pipeline/*.js`: the capture engine (browser, page prep, robots/opt-out checks, sections, subpage links); `scripts/capture.js` is its CLI
- `pipeline/judge/`: the Claude vision judge and tagger (rubric, image prep, output schema); `scripts/judge.js` is its CLI
- `pipeline/run.js`: the orchestrator (claims, resume, AI budget, logging); `scripts/pipeline.js` and `scripts/pipeline-status.js` are its CLIs
- `app/admin/`, `app/api/admin/**`: the local admin; `lib/admin.js` (loopback + env guard), `lib/admin-data.js` (its queries and actions), `lib/jobs.js` (in-process job queue)
- `app/api/removal/route.js`: public removal requests
- `next.config.mjs`: stamps each request with its real socket address for the admin guard and the rate limit
- `lib/jethro.js`: hash routing, search and filters, fetching from the API, infinite scroll, rendering and the lightbox

## URLs

State lives in the hash, so every view can be shared:
`#/apps` (sites), `#/screens`, `#/sections`, `#/app/<id>` (one site), plus
`?q=&platform=&pattern=&section=&industry=&color=&theme=&country=`. `platform`
is `desktop` or `mobile`, `color` a color bucket, `theme` `light` or `dark` and
`country` a two-letter code such as `JP`.
