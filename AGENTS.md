# AGENTS.md

Conventions for AI coding agents working in **bobbin**. This file is the
canonical entry point under the [AGENTS.md](https://agents.md) standard, and it
is the first thing a Fredrin Worker reads.

## Project

Bobbin is a public design-inspiration library, in the spirit of Mobbin but with
its own name, branding and content. Visitors browse apps and screens, search,
and filter by platform, UI pattern and industry. v1 has no accounts and no saved
collections.

## Commands

- Install: `npm install`. Database: `npm run db:migrate`. Dev: `npm run dev` (http://localhost:3000). Build: `npm run build`, then `npm start`.
- There is no test suite yet.

## Conventions

- Next.js App Router, plain JS (no TypeScript). `app/page.jsx` holds the static shell; `app/Bobbin.jsx` calls `mount()` from `lib/bobbin.js`, which renders into that shell imperatively. `mount()` must stay re-runnable: dev StrictMode mounts, cleans up and mounts again, so every listener it adds takes its `signal`.
- Visual changes must follow `styles.md` and use the `:root` tokens in `app/styles.css`. Do not hard-code new colors or radii.
- `--accent` only colors the icon of an active item or pill. It never fills a surface.
- Content is real websites captured by the pipeline. Guardrails: honor robots.txt, always show and link the source domain, never present a captured site's logo as Bobbin's own asset, and never capture or show an opted-out domain (`optouts` table). Placeholder SVG screens are gone; do not reintroduce fake apps.
- Data lives in a local SQLite database (`data/bobbin.db`, overridable with `BOBBIN_DATA_DIR`). Create or upgrade it with `npm run db:migrate`; schema changes are new numbered files in `db/migrations/`. Read and write it only through `lib/db.js`, and never import that module from client code (`app/Bobbin.jsx`, `lib/bobbin.js`).
- `lib/taxonomy.js` is the single source of platforms, page patterns, section types, industries and site statuses. Import from it; do not hard-code those lists.
- All view state lives in the URL hash (`#/apps`, `#/screens`, `#/app/<id>` with query filters). Unknown routes and values fall back to the browse view.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
