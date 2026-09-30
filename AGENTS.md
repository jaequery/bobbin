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

- Run: `python3 -m http.server 8000` (or `npx serve .`), then open `http://localhost:8000`.
- There is no build, no dependencies and no test suite yet.

## Conventions

- Plain HTML, CSS and JS with no framework or bundler. `data.js` loads before `app.js`, both as classic scripts.
- Visual changes must follow `styles.md` and use the `:root` tokens in `styles.css`. Do not hard-code new colors or radii.
- `--accent` only colors the icon of an active item or pill. It never fills a surface.
- Content must stay original: no real app names, logos or screenshots. Screens are procedural SVGs drawn in `app.js` (`screenSVG`).
- All view state lives in the URL hash (`#/apps`, `#/screens`, `#/app/<id>` with query filters). Unknown routes and values fall back to the browse view.
