# Bobbin

A public design-inspiration library for product designers. Visitors browse apps
and their screens, search by app name or UI pattern, and filter by platform
(Web, iOS, Android), UI pattern and industry. There is no sign-in and nothing is
saved. All apps and screenshots are original placeholders.

## Run it

Bobbin is a Next.js app (App Router). Node 20.9 or newer.

```sh
npm install
npm run dev                  # http://localhost:3000
npm run build && npm start   # production build
```

## Files

- `app/layout.jsx`: the document, metadata and font
- `app/page.jsx`: the page shell
- `app/Bobbin.jsx`: client component that mounts the renderer
- `app/styles.css`: design tokens and components
- `styles.md`: the style guide those tokens come from
- `lib/data.js`: the sample library (apps, screens, patterns, industries)
- `lib/bobbin.js`: hash routing, search and filters, rendering, the lightbox, and the procedural SVG screenshots

## URLs

State lives in the hash, so every view can be shared:
`#/apps`, `#/screens`, `#/app/<id>`, plus `?q=&platform=&pattern=&industry=`.
