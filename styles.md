# Bobbin style guide

Bobbin's visual system is copied from a reference screenshot the project owner
chose: a white, quiet library UI with a fixed left sidebar, an oversized pill
search bar, a row of pill toggles, and two-column app cards whose screenshots sit
on soft gradient backdrops.

Only the **styles** come from the reference. The logo, name, copy, apps and
screenshots are all Bobbin's own.

The reference was a Retina capture. It was measured in device pixels and divided
by ~1.45 to get CSS pixels, then rounded. The tokens below are the source of
truth, and `app/styles.css` implements them as custom properties on `:root`.

---

## 1. Color

| Token | Value | Use |
|---|---|---|
| `--bg` | `#FFFFFF` | Page and sidebar background |
| `--ink` | `#111111` | Primary text, primary button fill, app-logo tiles |
| `--ink-2` | `#3A3A3A` | Secondary body text (dialogs, fact chips) |
| `--mute` | `#7A7A7A` | Taglines, placeholder text, inactive pills |
| `--faint` | `#A3A3A3` | Tertiary text: counts in menus, trailing icons |
| `--surface` | `#F7F7F7` | Search field fill, hover fill, screen tiles |
| `--surface-2` | `#F2F2F2` | Active nav item, active pill, tile hover |
| `--line` | `#EBEBEB` | Hairline borders on search and pills |
| `--line-2` | `#E2E2E2` | Borders on active or selected items, outline button |
| `--accent` | `#F2622E` | The only accent. It colors the **icon** of the active nav item or pill and the focus ring. It never fills a surface. |
| `--scrim` | `rgba(12,12,12,.9)` | Lightbox backdrop |

**Card backdrops.** Each app has a two-stop `tone` (light, then dark) that is
drawn as `radial-gradient(120% 110% at 50% 45%, t1, t2)` with a soft dark
vignette on top. Each backdrop is a muted, desaturated version of the app's own
color, like a blurred screenshot bleeding into its frame. Examples: lavender and
slate for Plotter, sand and olive for Parcelry, blush and rose for Fieldnote,
silver and graphite for Ledgerly.

## 2. Typography

Font: **Inter** (Google Fonts, weights 400/500/600/700), falling back to
`ui-sans-serif, -apple-system, Segoe UI`. Letter-spacing is tight across the
whole UI: `-0.015em` by default and `-0.025em` on titles. Antialiasing is set to
`antialiased`.

| Role | Size | Weight | Color | Notes |
|---|---|---|---|---|
| Search input | 19.5px | 400 | `--ink` (placeholder `--mute`) | The largest text in the chrome |
| Nav item and pill label | 15.5px | 400 | `--ink` / `--mute` | Inactive pills are `--mute` |
| App name (card) | 20px | 500 | `--ink` | Tracking `-0.025em`, line-height 1.2 |
| App tagline (card) | 14.5px | 400 | `--mute` | Line-height 1.35 |
| Screen caption | 14.5px | 500 app name / 400 pattern | `--ink` / `--mute` | |
| Detail title | 30px | 500 | `--ink` | Tracking `-0.025em` |
| Menu item | 14.5px | 400 | `--ink` | Count at 12.5px in `--faint` |
| Badge | 12px | 400 | `--ink` | Tracking 0 |

## 3. Spacing and layout

| Token | Value | Use |
|---|---|---|
| `--sidebar-w` | 256px | Fixed sidebar column |
| `--gutter` | 42px | Main content side padding. 24px below 1100px, 16px on phones |
| Sidebar padding | 14px top, 7px left, 19px right | Nav items are 230px wide |
| Logo | 46px circle, 58px gap below | |
| Nav stack gap | 4px | 41px pitch between items |
| Search top offset | 8px | The search bar sits almost flush with the top |
| Search to pills | 8px | |
| Pill gap | 6px | Plus a 1×22px divider between view toggles and filter menus |
| Pills to content | 30px | |
| App grid | 2 columns, 16px column gap, 52px row gap | 1 column below 860px |
| Card to meta row | 19px | |
| Logo to name | 11px | |
| Screen grid | auto-fill, min 200px, 16px column gap, 36px row gap | 2 columns on phones |

## 4. Radius, borders and elevation

| Token | Value | Use |
|---|---|---|
| `--r-sm` | 8px | Web screenshot inside a card, menu items |
| `--r-md` | 10px | Nav items, buttons, app-logo tile, phone screenshots |
| `--r-lg` | 14px | Menus, large logo, lightbox shot |
| `--r-card` | 24px | Card frames, screen tiles, dialog |
| `--r-pill` | 999px | Search bar, pills, fact chips |

Borders are always 1px hairlines (`--line` / `--line-2`). The only shadows are:

- a lifted screenshot inside a card frame: `0 10px 30px rgba(0,0,0,.18)`
- a screenshot inside a tile: `0 1px 2px rgba(0,0,0,.06), 0 6px 18px rgba(0,0,0,.06)`
- popovers: `--shadow-pop` = `0 12px 32px rgba(0,0,0,.1), 0 2px 6px rgba(0,0,0,.05)`

## 5. Iconography

Line icons are drawn on a 24px grid, displayed at 20px, with 1.6 stroke width and
round caps and joins, stroked in `currentColor`. An icon turns `--accent` only
when its nav item or pill is active. Chevrons and clear buttons are 14px in
`--mute`.

## 6. Components

### Sidebar
- **Logo**: a 46px circle-outline mark (4px stroke, `--ink`) with Bobbin's "b" inside.
- **Primary button** (`.btn-primary`): 37px tall, `--ink` fill, white text and
  icon, `--r-md`, 13px horizontal padding, 10px icon gap. Label: "New search".
- **Nav item** (`.nav-item`): 37px tall, transparent with a transparent 1px
  border. On hover it takes the `--surface` fill. When active
  (`aria-current="page"`) it takes the `--surface-2` fill, a `--line-2` border
  and an `--accent` icon.
- **Badge** (`.badge`): 20px tall, 1.2px `--ink` border, 5px radius, 12px text,
  placed inline after a nav label. It is defined in `app/styles.css` but v1 does not use it yet.
- **Footer** stack, pinned to the bottom: plain nav items, then an **outline
  button** (`.btn-outline`), 39px tall with a white fill, a `--line-2` border and
  `--r-md`.

### Search bar
59px tall, full pill, `--surface` fill, a 1px `--line` border, 16px left and 20px
right padding. A trailing search icon sits in `--faint`, and it swaps to a clear
(×) button while a query is present. Pressing `/` focuses it.

### Pills
37px tall, full pill, a 1px `--line` border on white, 12px left and 16px right
padding, 9px icon gap.
- Inactive: `--mute` label with an `--ink` icon.
- Active or set (`aria-pressed="true"` / `.is-set`): `--surface-2` fill, a
  `--line-2` border, an `--ink` label and an `--accent` icon.
- Menu pills end in a chevron. Once a value is set, the chevron becomes a clear
  (×) button.
- The **menu** is a white popover with a `--line` border, `--r-lg` and
  `--shadow-pop`, anchored 6px below its pill. Items are 34px tall with a result
  count on the right.

### App card
- **Frame**: aspect ratio **511 / 314**, `--r-card`, gradient backdrop and
  vignette.
- **Web app**: one browser screenshot inset **5.9% left/right and 9.6%
  top/bottom**, with `--r-sm` and a lifted shadow.
- **iOS and Android apps**: up to three phone screenshots in the same inset,
  full height, 4% apart, with `--r-md`.
- On hover the screenshot rises 4px and scales to 1.01 over 0.35s.
- **Meta row**: a 45px `--ink` logo tile (`--r-md`, white initial, and a 6px dot
  in the app's color at bottom-right), then the name (20/500) over the tagline
  (14.5, `--mute`).

### Screen tile
The tile is aspect ratio 4/5 with a `--surface` fill, `--r-card` and 22px
padding, and the screenshot is centred inside it. Phones fill the tile's height
and web screens fill its width. The caption underneath shows a 24px logo, the
app name (500) and the pattern (`--mute`).

### App detail
A "← All apps" back link, then a 64px logo with a 30px title and a 16px tagline.
Fact chips are 30px pills with a `--line` border and 13.5px text. Pattern pills
filter the gallery.

### Lightbox
A full-screen `--scrim` with a top bar showing the white logo tile, the app name
and "pattern · platform · n of N", plus a round 40px close button. The screen is
centred with round 40px prev/next buttons, which use a translucent white fill.
The keyboard controls are Esc, ← and →, and Tab stays inside the viewer.

### Empty state
Centred text: a "No matches" title (22/500) and a muted explanation, with an
outline "Clear filters" button underneath.

## 7. Motion
Motion is kept short and quiet. Hover lifts take 0.3–0.35s ease and background
fills take 0.2s. There is no entrance animation.

## 8. Responsive
- **≤1100px**: the gutter shrinks to 24px.
- **≤860px**: the sidebar becomes a top bar with the logo, "New search" and
  horizontally scrolling platform items, and its footer is hidden. The search
  bar drops to 50px tall with 17px text. The app grid becomes 1 column and the
  screen grid 2 columns. There is never any horizontal page scroll.
