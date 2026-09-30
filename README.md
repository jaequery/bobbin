# Bobbin

A public design-inspiration library for product designers. Visitors browse apps
and their screens, search by app name or UI pattern, and filter by platform
(Web, iOS, Android), UI pattern and industry. There is no sign-in and nothing is
saved. All apps and screenshots are original placeholders.

## Run it

This is a static site with no build step.

```sh
python3 -m http.server 8000   # or: npx serve .
```

Then open <http://localhost:8000>.

## Files

- `index.html`: the page shell
- `styles.css`: design tokens and components
- `styles.md`: the style guide those tokens come from
- `data.js`: the sample library (apps, screens, patterns, industries)
- `app.js`: hash routing, search and filters, rendering, the lightbox, and the procedural SVG screenshots

## URLs

State lives in the hash, so every view can be shared:
`#/apps`, `#/screens`, `#/app/<id>`, plus `?q=&platform=&pattern=&industry=`.
