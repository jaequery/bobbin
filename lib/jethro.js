import { PLATFORMS, PAGE_PATTERNS, SECTION_TYPES, INDUSTRIES, COLOR_BUCKETS, THEMES } from "./taxonomy";
import { countryName, isCountryCode, regionOf } from "./regions";

// Window scroll offset per history entry key (see "Scroll restoration" in mount).
// Module-level so it survives the StrictMode remount.
const SCROLL = new Map();

// Wires the imperative renderer to the shell markup in app/page.jsx. Browser
// only; returns a cleanup that removes the listeners, observers and fetches it
// started. Data comes from the route handlers in app/api/**.
export function mount() {
  const ac = new AbortController();
  const { signal } = ac;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Icons (inline line icons) ----------
  const ICON = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    desktop: '<rect x="3.5" y="5" width="17" height="11.5" rx="2"/><path d="M2 19h20"/>',
    mobile: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
    sections: '<rect x="4" y="4" width="16" height="5" rx="1.5"/><rect x="4" y="11" width="16" height="9" rx="1.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v5h5"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    pattern: '<path d="M4 6h16M4 12h10M4 18h7"/>',
    industry: '<path d="M4 20V9l5 3V9l5 3V5h6v15H4Z"/>',
    external: '<path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/>',
    color: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.7 0-.9.7-1.6 1.7-1.6h2.1a4 4 0 0 0 4-4C20.5 6.6 16.7 3.5 12 3.5Z"/><circle cx="7.8" cy="11" r=".9"/><circle cx="10.5" cy="7.5" r=".9"/><circle cx="15" cy="7.8" r=".9"/>',
    theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17Z"/>',
    filters: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5Z"/>',
  };
  const icon = (name, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

  // Per-site backdrop colors are data from the pipeline; only accept plain hex.
  const hex = (c) => (/^#[0-9a-f]{3,8}$/i.test(c || "") ? c : "");
  const platformLabel = (id) => PLATFORMS.find((p) => p.id === id)?.label || id;
  // Jethro's own initial tile. A captured site's logo is never shown as ours.
  const logo = (name, tone) => `<span class="app-logo" aria-hidden="true">${esc((name || "?")[0].toUpperCase())}${hex(tone) ? `<i style="background:${hex(tone)}"></i>` : ""}</span>`;
  const outLink = (href, label, cls = "") => `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener nofollow">${label}</a>`;

  // ---------- Fetch client ----------
  async function api(path, params, sig) {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v)).toString();
    const res = await fetch(`/api/${path}${qs ? "?" + qs : ""}`, { signal: sig });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      const err = new Error(body?.error?.message || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return body.data;
  }

  // ---------- State <-> hash ----------
  const EMPTY = { q: "", platform: "", pattern: "", section: "", industry: "", color: "", theme: "", country: "" };
  const ALLOWED = {
    platform: PLATFORMS.map((p) => p.id), pattern: PAGE_PATTERNS, section: SECTION_TYPES, industry: INDUSTRIES,
    color: COLOR_BUCKETS.map((c) => c.id), theme: THEMES.map((t) => t.id),
  };
  let state = { view: "apps", appId: null, ...EMPTY };

  function readHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, query = ""] = raw.split("?");
    const params = new URLSearchParams(query);
    const parts = path.split("/").filter(Boolean);
    const next = { view: "apps", appId: null, ...EMPTY };
    if (parts[0] === "screens" || parts[0] === "sections") next.view = parts[0];
    else if (parts[0] === "app" && /^[\w-]{1,64}$/.test(parts[1] || "")) { next.view = "app"; next.appId = parts[1]; }
    for (const k of Object.keys(EMPTY)) next[k] = params.get(k) || "";
    // Ignore unknown filter values rather than showing an impossible empty state.
    for (const [k, list] of Object.entries(ALLOWED)) if (!list.includes(next[k])) next[k] = "";
    if (!isCountryCode(next.country)) next.country = "";
    // A site's page only filters by platform tab and page pattern.
    if (next.view === "app") Object.assign(next, { q: "", section: "", industry: "", color: "", theme: "", country: "" });
    return next;
  }

  function toHash(s) {
    const params = new URLSearchParams();
    for (const k of Object.keys(EMPTY)) if (s[k]) params.set(k, s[k]);
    const qs = params.toString();
    const path = s.view === "app" ? `app/${s.appId}` : s.view;
    return `#/${path}${qs ? "?" + qs : ""}`;
  }

  function go(patch, { replace = false } = {}) {
    const next = { ...state, ...patch };
    const hash = toHash(next);
    if (hash === location.hash) { state = next; render(); return; }
    if (replace) { history.replaceState(history.state, "", hash); state = next; render(); }
    else location.hash = hash; // hashchange renders
  }

  const filtersOf = (s) => Object.fromEntries(Object.keys(EMPTY).map((k) => [k, s[k]]));
  const hasFilters = (s) => Boolean(s.q.trim() || s.platform || s.pattern || s.section || s.industry || s.color || s.theme || s.country);

  // ---------- Library meta (filter counts) ----------
  let meta = null;
  api("library/meta", null, signal).then((m) => { meta = m; renderToolbar(); }, () => {});

  // ---------- Sidebar ----------
  function renderSidebar() {
    const plat = [["", "All platforms", "grid"], ...PLATFORMS.map((p) => [p.id, p.label, p.id])];
    $("#nav").innerHTML =
      `<button class="btn-primary" type="button" data-action="new-search">${icon("plus")}New search</button>` +
      plat.map(([val, label, ic]) =>
        `<button class="nav-item" type="button" data-platform="${val}" ${state.platform === val && state.view !== "app" ? 'aria-current="page"' : ""}>${icon(ic)}${label}</button>`
      ).join("");
    $("#about-btn").innerHTML = `${icon("info")}About Jethro`;
    $("#reset-btn").innerHTML = `${icon("reset")}Reset filters`;
  }

  // ---------- Toolbar ----------
  let openMenu = null;
  // The filter menus sit collapsed behind one icon until the visitor opens them;
  // they then stay open for the session, across hash changes.
  let filtersOpen = false;
  const FACETS = ["platform", "pattern", "section", "industry", "color", "theme", "country"];
  // A color bucket's dot; the color is data from lib/taxonomy.js, not a theme token.
  const swatch = (o) => (o?.swatch ? `<span class="swatch" style="background:${hex(o.swatch)}"></span>` : "");
  // Options may carry a `swatch` and a `group` (a heading shown when it changes).
  function menuPill(key, label, ic, options) {
    const val = state[key];
    const shown = meta ? options.filter((o) => o.count || o.value === val) : options;
    let group = null;
    const item = (o) => {
      const head = o.group && o.group !== group ? `<div class="menu-group" role="presentation">${esc((group = o.group))}</div>` : "";
      return head + `<button role="menuitemradio" aria-checked="${val === o.value}" data-set="${key}" data-val="${esc(o.value)}"><span class="lbl">${swatch(o)}${esc(o.label)}</span>${o.count != null ? `<small>${o.count}</small>` : ""}</button>`;
    };
    const menu = openMenu === key
      ? `<div class="menu" role="menu" aria-label="${label}">` +
        `<button role="menuitemradio" aria-checked="${!val}" data-set="${key}" data-val="">Any ${label.toLowerCase()}</button>` +
        shown.map(item).join("") +
        `</div>`
      : "";
    const clear = val ? `<span class="x" role="button" tabindex="0" aria-label="Clear ${label}" data-set="${key}" data-val="">${icon("x", "i chev")}</span>` : icon("chev", "i chev");
    const picked = val ? options.find((o) => o.value === val) : null;
    const text = val ? picked?.label || val : label;
    return `<span class="menu-wrap"><button class="pill ${val ? "is-set" : ""}" type="button" aria-haspopup="menu" aria-expanded="${openMenu === key}" data-menu="${key}">${val && picked?.swatch ? swatch(picked) : icon(ic)}${esc(text)}${clear}</button>${menu}</span>`;
  }

  const facet = (key, list) => meta?.[key] || list.map((v) => (typeof v === "object" ? { value: v.id, label: v.label, swatch: v.swatch } : { value: v, label: v }));
  // Countries come only from the library meta (those with public sites), grouped by region.
  function countryOptions() {
    const list = meta?.countries || [];
    const opts = list.map((c) => ({ ...c, group: c.region }));
    if (state.country && !list.some((c) => c.value === state.country)) {
      opts.push({ value: state.country, label: countryName(state.country), group: regionOf(state.country), count: 0 });
    }
    return opts;
  }

  const NOUNS = { apps: ["site", "sites"], screens: ["screen", "screens"], sections: ["section", "sections"] };
  let listTotal = null;
  const countText = () => (listTotal == null ? "" : `${listTotal} ${NOUNS[state.view][listTotal === 1 ? 0 : 1]}`);
  function updateCount() { const c = $("#toolbar .count"); if (c) c.textContent = countText(); }

  function filtersToggle() {
    const n = FACETS.filter((k) => state[k]).length;
    const label = `${filtersOpen ? "Hide" : "Show"} filters${n ? ` (${n} active)` : ""}`;
    return `<button class="pill filters-toggle" type="button" aria-expanded="${filtersOpen}"${filtersOpen ? ' aria-controls="filter-set"' : ""} aria-label="${label}" title="${label}" data-action="toggle-filters">` +
      `${icon("filters")}${n && !filtersOpen ? `<span class="badge" aria-hidden="true">${n}</span>` : ""}</button>`;
  }

  function renderToolbar() {
    const tb = $("#toolbar");
    if (state.view === "app") {
      const site = detail?.id === state.appId ? detail : null;
      if (!site) { tb.innerHTML = ""; return; }
      const platform = detailPlatform(site);
      const present = PAGE_PATTERNS.filter((p) => site.screens.some((s) => s.platform === platform && (s.pattern || "Other") === p));
      tb.innerHTML =
        PLATFORMS.filter((p) => site.screens.some((s) => s.platform === p.id)).map((p) =>
          `<button class="pill" type="button" aria-pressed="${platform === p.id}" data-set="platform" data-val="${p.id}">${icon(p.id)}${p.label}</button>`).join("") +
        `<span class="sep" aria-hidden="true"></span>` +
        `<button class="pill" type="button" aria-pressed="${!state.pattern}" data-set="pattern" data-val="">${icon("layers")}All pages</button>` +
        present.map((p) => `<button class="pill" type="button" aria-pressed="${state.pattern === p}" data-set="pattern" data-val="${esc(p)}">${esc(p)}</button>`).join("");
      return;
    }
    tb.innerHTML =
      `<button class="pill" type="button" aria-pressed="${state.view === "apps"}" data-view="apps">${icon("grid")}Sites</button>` +
      `<button class="pill" type="button" aria-pressed="${state.view === "screens"}" data-view="screens">${icon("layers")}Screens</button>` +
      `<button class="pill" type="button" aria-pressed="${state.view === "sections"}" data-view="sections">${icon("sections")}Sections</button>` +
      `<span class="sep" aria-hidden="true"></span>` +
      filtersToggle() +
      (filtersOpen
        ? `<span class="filter-set" id="filter-set" role="group" aria-label="Filters">` +
          menuPill("platform", "Platform", "desktop", facet("platforms", PLATFORMS)) +
          menuPill("pattern", "Pattern", "pattern", facet("patterns", PAGE_PATTERNS)) +
          menuPill("section", "Section", "sections", facet("sections", SECTION_TYPES)) +
          menuPill("industry", "Industry", "industry", facet("industries", INDUSTRIES)) +
          menuPill("color", "Color", "color", facet("colors", COLOR_BUCKETS)) +
          menuPill("theme", "Theme", "theme", facet("themes", THEMES)) +
          menuPill("country", "Country", "globe", countryOptions()) +
          `</span>`
        : "") +
      `<span class="count">${countText()}</span>`;
  }

  // ---------- Cards ----------
  const altOf = (it) => `${it.siteName} — ${it.pattern || it.type || "page"} (${platformLabel(it.platform)})`;
  const thumb = (it) => `<img src="${esc(it.sm)}" srcset="${esc(it.sm)} 1x, ${esc(it.lg)} 2x" alt="${esc(altOf(it))}" loading="lazy" decoding="async">`;

  function siteCard(site) {
    const { desktop: d, mobile: m } = site.cover;
    const inner = d
      ? `<div class="shot-web ${m ? "" : "solo"}">${thumb(d)}</div>${m ? `<div class="shot-phone">${thumb(m)}</div>` : ""}`
      : m ? `<div class="shot-row"><div>${thumb(m)}</div></div>` : "";
    const href = toHash({ ...EMPTY, view: "app", appId: site.id, platform: state.platform, pattern: state.pattern });
    const tag = [site.domain, site.tagline].filter(Boolean).join(" — ");
    return `<a class="app-card" href="${esc(href)}" aria-label="${esc(site.name)}, ${esc(site.domain)}${site.industry ? ", " + esc(site.industry) : ""}">
      <div class="frame" style="--t1:${hex(site.toneA) || "var(--surface-2)"};--t2:${hex(site.toneB) || "var(--line-2)"}">${inner}</div>
      <div class="meta">${logo(site.name, site.toneB)}<div><div class="name">${esc(site.name)}</div><div class="tag">${esc(tag)}</div></div></div>
    </a>`;
  }

  function screenCard(sc, i, caption = sc.pattern || "Page", showSite = true) {
    return `<button class="screen-card ${sc.platform}" type="button" data-shot="${i}">
      <div class="tile"><div>${thumb(sc)}</div></div>
      <div class="cap">${showSite ? `${logo(sc.siteName, sc.toneB)}<b>${esc(sc.siteName)}</b>` : ""}<span>${esc(caption)}</span></div>
    </button>`;
  }

  function sectionCard(x, i, showSite = true) {
    return `<button class="screen-card section-card" type="button" data-shot="${i}">
      <div class="tile"><img src="${esc(x.sm)}" srcset="${esc(x.sm)} 1x, ${esc(x.img)} 2x" width="${x.width}" height="${x.height}" alt="${esc(altOf(x))}" loading="lazy" decoding="async"></div>
      <div class="cap">${showSite ? `${logo(x.siteName)}<b>${esc(x.siteName)}</b>` : ""}<span>${esc(x.type || "Section")}${showSite ? "" : ` · ${esc(x.path)}`}</span></div>
    </button>`;
  }

  // ---------- States ----------
  function emptyState() {
    return `<div class="empty"><h2>No matches</h2><div>Nothing fits “${esc(state.q.trim() || "these filters")}”. Try a different pattern or clear your filters.</div><button class="btn-outline" type="button" data-action="reset">${icon("reset")}Clear filters</button></div>`;
  }
  const emptyLibrary = () => `<div class="empty"><h2>No sites yet</h2><div>Run <code>npm run pipeline</code> to fill the library.</div></div>`;
  const errorState = (err) => `<div class="empty"><h2>Couldn’t load the library</h2><div>${esc(err.message)}</div><button class="btn-outline" type="button" data-action="retry">${icon("reset")}Try again</button></div>`;

  const LISTS = {
    apps: { path: "sites", grid: "app-grid", card: (it) => siteCard(it), skel: '<div class="app-card"><div class="frame skel"></div></div>', n: 6 },
    screens: { path: "screens", grid: "screen-grid", card: (it, i) => screenCard(it, i), skel: '<div class="screen-card"><div class="tile"></div></div>', n: 12 },
    sections: { path: "sections", grid: "screen-grid section-grid", card: (it, i) => sectionCard(it, i), skel: '<div class="screen-card section-card"><div class="tile"></div></div>', n: 12 },
  };

  // ---------- Views ----------
  let items = []; // what the lightbox steps through, in on-screen order
  let viewCtl = null, observer = null, loadMore = null;
  let detail = null; // the last site fetched for #/app/<id>

  function renderList(sig) {
    const L = LISTS[state.view];
    const view = $("#view");
    const filters = filtersOf(state);
    let next = null, busy = false;
    view.innerHTML = `<div class="${L.grid}" aria-busy="true">${L.skel.repeat(L.n)}</div>`;

    const fail = (err) => { if (!sig.aborted) view.innerHTML = errorState(err); };
    api(L.path, filters, sig).then((data) => {
      if (sig.aborted) return;
      listTotal = data.total;
      updateCount();
      if (!data.items.length) { view.innerHTML = hasFilters(state) ? emptyState() : emptyLibrary(); return; }
      items = data.items.slice();
      view.innerHTML = `<div class="${L.grid}">${items.map((it, i) => L.card(it, i)).join("")}</div><div class="sentinel"></div>`;
      next = data.next;
      if (next) watch();
    }, fail);

    // Infinite scroll: fetch the next page when the sentinel nears the viewport.
    function watch() {
      const sentinel = view.querySelector(".sentinel");
      observer?.disconnect();
      observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) loadMore(); }, { rootMargin: "1200px 0px" });
      observer.observe(sentinel);
    }
    loadMore = () => {
      if (busy || !next || sig.aborted) return;
      busy = true;
      const sentinel = view.querySelector(".sentinel");
      sentinel.innerHTML = "";
      api(L.path, { ...filters, cursor: next }, sig).then((data) => {
        if (sig.aborted) return;
        const start = items.length;
        items.push(...data.items);
        view.querySelector(`.${L.grid.split(" ")[0]}`).insertAdjacentHTML("beforeend", data.items.map((it, i) => L.card(it, start + i)).join(""));
        next = data.next;
        busy = false;
        if (next) watch(); // re-observing fires again if the sentinel is still in view
        else { observer?.disconnect(); sentinel.remove(); }
      }, (err) => {
        busy = false;
        if (sig.aborted) return;
        observer?.disconnect();
        sentinel.innerHTML = `<button class="btn-outline" type="button" data-action="more">${icon("reset")}Couldn’t load more — try again</button>`;
      });
    };
  }

  // The detail page shows one platform at a time; default to desktop when the site has it.
  function detailPlatform(site) {
    if (state.platform && site.screens.some((s) => s.platform === state.platform)) return state.platform;
    return site.screens.some((s) => s.platform === "desktop") ? "desktop" : "mobile";
  }

  function renderDetail(sig) {
    const view = $("#view");
    if (detail?.id === state.appId) { drawDetail(detail); return; }
    view.innerHTML = `<div class="detail-head"><span class="app-logo skel"></span></div><div class="screen-grid" aria-busy="true">${LISTS.screens.skel.repeat(8)}</div>`;
    api(`sites/${encodeURIComponent(state.appId)}`, null, sig).then((site) => {
      if (sig.aborted) return;
      detail = site;
      renderToolbar();
      drawDetail(site);
    }, (err) => {
      if (sig.aborted) return;
      // Unknown or no-longer-public site: fall back to the browse view.
      if (err.status === 404) go({ view: "apps", appId: null, pattern: "" }, { replace: true });
      else view.innerHTML = errorState(err);
    });
  }

  function drawDetail(site) {
    const platform = detailPlatform(site);
    const screens = site.screens.filter((s) => s.platform === platform && (!state.pattern || (s.pattern || "Other") === state.pattern));
    const sections = site.sections.filter((x) => x.platform === platform && (!state.pattern || (x.pattern || "Other") === state.pattern));
    // Pages grouped by pattern, in taxonomy order.
    const rank = (s) => PAGE_PATTERNS.indexOf(s.pattern || "Other");
    const pages = screens.slice().sort((a, b) => rank(a) - rank(b));
    items = [...pages, ...sections];
    let i = 0;
    const date = site.capturedAt ? new Date(site.capturedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
    $("#view").innerHTML = `
      <button class="back" type="button" data-action="back">${icon("back")}All sites</button>
      <div class="detail-head">${logo(site.name, site.toneB)}<div><h1>${esc(site.name)}</h1>${site.tagline ? `<p>${esc(site.tagline)}</p>` : ""}</div></div>
      <div class="facts">
        ${site.industry ? `<span class="fact">${esc(site.industry)}</span>` : ""}
        ${site.country ? `<span class="fact">${esc(site.country)}</span>` : ""}
        <span class="fact">${site.pages.length} ${site.pages.length === 1 ? "page" : "pages"}</span>
        ${outLink(site.url, `Visit site ${icon("external", "i ext")}`, "fact visit")}
      </div>
      <p class="attribution">Screenshots captured ${esc(date)} from ${outLink(site.url, esc(site.domain))}.</p>
      <div class="screen-grid">${pages.map((sc) => screenCard(sc, i++, `${sc.pattern || "Other"} · ${sc.path}`, false)).join("")}</div>
      ${sections.length ? `<h2 class="group-title">Sections</h2><div class="section-strip">${sections.map((x) => sectionCard(x, i++, false)).join("")}</div>` : ""}`;
  }

  function renderView() {
    viewCtl?.abort();
    observer?.disconnect();
    observer = null; loadMore = null; listTotal = null; items = [];
    viewCtl = new AbortController();
    const sig = AbortSignal.any([signal, viewCtl.signal]);
    if (state.view === "app") renderDetail(sig);
    else renderList(sig);
  }

  // ---------- Lightbox ----------
  let lbIndex = -1, lbReturn = null;
  function openLightbox(i) {
    lbReturn = document.activeElement;
    lbIndex = i;
    renderLightbox();
    $("#lightbox").hidden = false;
    document.body.style.overflow = "hidden";
    $("#lightbox [data-lb=close]").focus();
  }
  function closeLightbox() {
    $("#lightbox").hidden = true;
    document.body.style.overflow = "";
    lbIndex = -1;
    if (lbReturn) lbReturn.focus();
  }
  function renderLightbox() {
    const it = items[lbIndex];
    if (!it) return closeLightbox();
    const isSection = it.img !== undefined;
    const label = [isSection ? it.type || "Section" : it.pattern || "Page", it.path, platformLabel(it.platform), `${lbIndex + 1} of ${items.length}`].filter(Boolean);
    $("#lightbox").innerHTML = `
      <div class="lb-bar">${logo(it.siteName, it.toneB)}<div><b>${esc(it.siteName)}</b><br><span>${label.map(esc).join(" · ")}</span></div>
        <span class="spacer"></span>${outLink(it.url || `https://${it.domain}/`, `${esc(it.domain)} ${icon("external", "i ext")}`, "lb-link")}
        <button class="lb-btn" type="button" data-lb="close" aria-label="Close viewer">${icon("x")}</button></div>
      <div class="lb-stage">
        <button class="lb-btn" type="button" data-lb="prev" aria-label="Previous" ${lbIndex === 0 ? "disabled" : ""}>${icon("left")}</button>
        <div class="lb-shot ${it.platform}"><div class="lb-scroll" tabindex="0" aria-label="Full page, scrollable">
          <img src="${esc(isSection ? it.img : it.full)}" width="${it.width || ""}" height="${it.height || ""}" alt="${esc(altOf(it))}" decoding="async">
        </div></div>
        <button class="lb-btn" type="button" data-lb="next" aria-label="Next" ${lbIndex === items.length - 1 ? "disabled" : ""}>${icon("right")}</button>
      </div>`;
  }
  function stepLightbox(d) {
    const n = lbIndex + d;
    if (n < 0 || n >= items.length) return;
    lbIndex = n; renderLightbox(); $("#lightbox [data-lb=close]").focus();
    if (n >= items.length - 3 && loadMore) loadMore();
  }

  // ---------- Render ----------
  function render() {
    renderSidebar();
    renderToolbar();
    renderView();
    const q = $("#q");
    if (q.value !== state.q) q.value = state.q;
    $("#clear-q").hidden = !state.q;
    $("#clear-q").innerHTML = icon("x");
    $("#search-icon").innerHTML = state.q ? "" : icon("search");
  }

  // ---------- Search suggestions ----------
  // Fetched 120ms after the last keystroke; a newer keystroke aborts the older fetch.
  let sugItems = [], sugActive = -1, sugTimer = null, sugCtl = null;
  const SUG_KIND = { site: "Site", pattern: "Page pattern", section: "Section", industry: "Industry" };

  function closeSuggest() {
    clearTimeout(sugTimer);
    sugCtl?.abort();
    sugItems = []; sugActive = -1;
    $("#suggest").hidden = true;
    $("#suggest").innerHTML = "";
    $("#q").setAttribute("aria-expanded", "false");
    $("#q").removeAttribute("aria-activedescendant");
  }

  function drawSuggest() {
    const box = $("#suggest");
    if (!sugItems.length) { closeSuggest(); return; }
    box.innerHTML = sugItems.map((it, i) =>
      `<div class="sug" role="option" id="sug-${i}" data-sug="${i}" aria-selected="${i === sugActive}">` +
      `<span class="sug-ic">${icon(it.kind === "site" ? "grid" : it.kind === "section" ? "sections" : it.kind === "industry" ? "industry" : "pattern")}</span>` +
      `<span class="sug-text"><b>${esc(it.label)}</b><small>${esc(it.kind === "site" ? it.sub : SUG_KIND[it.kind])}</small></span></div>`).join("");
    box.hidden = false;
    $("#q").setAttribute("aria-expanded", "true");
    if (sugActive >= 0) $("#q").setAttribute("aria-activedescendant", `sug-${sugActive}`);
    else $("#q").removeAttribute("aria-activedescendant");
  }

  function scheduleSuggest(text) {
    clearTimeout(sugTimer);
    sugCtl?.abort();
    if (!text.trim()) { closeSuggest(); return; }
    sugTimer = setTimeout(() => {
      sugCtl = new AbortController();
      const sig = AbortSignal.any([signal, sugCtl.signal]);
      api("suggest", { q: text }, sig).then((data) => {
        if (sig.aborted || $("#q").value !== text || document.activeElement !== $("#q")) return;
        sugItems = data.items; sugActive = -1;
        drawSuggest();
      }, () => {});
    }, 120);
  }

  function pickSuggest(it) {
    closeSuggest();
    const back = state.view === "app" ? "screens" : state.view;
    if (it.kind === "site") go({ ...EMPTY, view: "app", appId: it.value });
    else if (it.kind === "pattern") go({ q: "", pattern: it.value, view: back === "sections" ? "screens" : back, appId: null });
    else if (it.kind === "section") go({ q: "", section: it.value, view: "sections", appId: null });
    else if (it.kind === "industry") go({ q: "", industry: it.value, view: back, appId: null });
  }

  function reset() { openMenu = null; go({ ...EMPTY, view: state.view === "app" ? "apps" : state.view, appId: null }); }

  // ---------- Events ----------
  // Keep focus in the search field while a suggestion is pressed.
  $("#suggest").addEventListener("mousedown", (e) => e.preventDefault(), { signal });
  $("#suggest").addEventListener("click", (e) => {
    const t = e.target.closest("[data-sug]");
    if (t) pickSuggest(sugItems[Number(t.dataset.sug)]);
  }, { signal });
  $("#q").addEventListener("blur", closeSuggest, { signal });

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-action],[data-platform],[data-view],[data-set],[data-menu],[data-shot],[data-lb]");
    if (!t) { if (openMenu) { openMenu = null; renderToolbar(); } return; }
    const d = t.dataset;
    if (d.lb) { if (d.lb === "close") closeLightbox(); else stepLightbox(d.lb === "next" ? 1 : -1); return; }
    if (d.shot !== undefined) { openLightbox(Number(d.shot)); return; }
    if (d.action === "new-search") { openMenu = null; go({ ...EMPTY, view: state.view === "app" ? "screens" : state.view, appId: null }); $("#q").focus(); return; }
    if (d.action === "toggle-filters") { filtersOpen = !filtersOpen; openMenu = null; renderToolbar(); $("#toolbar .filters-toggle").focus(); return; }
    if (d.action === "reset") { reset(); return; }
    if (d.action === "retry") { renderView(); return; }
    if (d.action === "more") { loadMore?.(); return; }
    if (d.action === "back") { go({ view: "apps", appId: null, pattern: "" }); return; }
    if (d.platform !== undefined) { go({ platform: d.platform, view: state.view === "app" ? "apps" : state.view, appId: null }); return; }
    if (d.view) { openMenu = null; go({ view: d.view }); return; }
    if (d.set) { e.stopPropagation(); openMenu = null; go({ [d.set]: d.val }); return; }
    if (d.menu) {
      openMenu = openMenu === d.menu ? null : d.menu;
      renderToolbar();
      const first = document.querySelector(".menu button[aria-checked=true]") || document.querySelector(".menu button");
      if (first) first.focus();
    }
  }, { signal });

  $("#about-btn").addEventListener("click", () => $("#about").showModal(), { signal });

  // ---------- Removal request ----------
  const removal = $("#removal-form");
  function showFieldErrors(fields = {}) {
    for (const el of removal.querySelectorAll(".field[data-field]")) {
      const msg = fields[el.dataset.field];
      el.classList.toggle("invalid", !!msg);
      const err = el.querySelector(".err");
      if (err) { err.hidden = !msg; err.textContent = msg || ""; }
    }
  }
  $("#removal-open").addEventListener("click", () => {
    $("#about").close();
    showFieldErrors();
    $("#removal-status").textContent = "";
    $("#removal").showModal();
  }, { signal });
  $("#removal-close").addEventListener("click", () => $("#removal").close(), { signal });
  removal.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = removal.querySelector("[type=submit]");
    const status = $("#removal-status");
    const body = Object.fromEntries(new FormData(removal));
    showFieldErrors();
    status.textContent = "Sending…";
    button.disabled = true;
    try {
      const res = await fetch("/api/removal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showFieldErrors(json?.error?.fields);
        status.textContent = json?.error?.message || `Request failed (${res.status})`;
        return;
      }
      status.textContent = json.data.message;
      removal.reset();
      // The domain is hidden now: refresh what is on screen.
      detail = null;
      api("library/meta", null, signal).then((m) => { meta = m; renderToolbar(); }, () => {});
      renderView();
    } catch (err) {
      if (!signal.aborted) status.textContent = "Could not send the request. Check your connection and try again.";
    } finally {
      button.disabled = false;
    }
  }, { signal });
  $("#reset-btn").addEventListener("click", reset, { signal });
  $("#clear-q").addEventListener("click", () => { closeSuggest(); go({ q: "" }, { replace: true }); $("#q").focus(); }, { signal });

  $("#q").addEventListener("input", (e) => {
    const patch = { q: e.target.value };
    if (state.view === "app") { patch.view = "screens"; patch.appId = null; patch.pattern = ""; }
    go(patch, { replace: state.view !== "app" });
    scheduleSuggest(e.target.value);
  }, { signal });

  $("#q").addEventListener("keydown", (e) => {
    const open = !$("#suggest").hidden;
    if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); closeSuggest(); return; }
    if (!open || !sugItems.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = sugItems.length;
      sugActive = e.key === "ArrowDown" ? (sugActive + 1) % n : (sugActive - 1 + n) % n;
      drawSuggest();
      $(`#sug-${sugActive}`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (sugActive >= 0) pickSuggest(sugItems[sugActive]);
      else closeSuggest();
    }
  }, { signal });

  document.addEventListener("keydown", (e) => {
    if (!$("#lightbox").hidden) {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowRight") stepLightbox(1);
      else if (e.key === "ArrowLeft") stepLightbox(-1);
      else if (e.key === "Tab") { // keep focus inside the viewer
        const f = [...$("#lightbox").querySelectorAll("a[href], button:not([disabled]), [tabindex='0']")];
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
      return;
    }
    if (openMenu && e.key === "Escape") { const k = openMenu; openMenu = null; renderToolbar(); document.querySelector(`[data-menu="${k}"]`).focus(); return; }
    if (openMenu && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      const list = [...document.querySelectorAll(".menu button")];
      const i = list.indexOf(document.activeElement);
      e.preventDefault();
      list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length].focus();
      return;
    }
    if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $("#q").focus(); }
  }, { signal });

  // ---------- Scroll restoration ----------
  // Every route change re-renders #view and refetches the list, so the browser's
  // own restoration runs against a page that is not tall enough yet. Instead each
  // history entry gets a key in history.state, the window offset is recorded per
  // key, and on Back/Forward it is re-applied as the list and its infinite-scroll
  // pages grow (being at the bottom keeps the sentinel in view, so pages load).
  const prevRestoration = history.scrollRestoration;
  history.scrollRestoration = "manual";
  let entryKey = null, restoreStop = null;

  // Returns the saved offset when this entry was visited before (a traversal).
  function trackEntry() {
    const st = history.state && typeof history.state === "object" ? history.state : {};
    if (typeof st.jethroKey === "string") { entryKey = st.jethroKey; return SCROLL.get(entryKey); }
    entryKey = Math.random().toString(36).slice(2);
    history.replaceState({ ...st, jethroKey: entryKey }, "");
    return undefined;
  }

  function restoreScroll(y) {
    const ctl = new AbortController();
    let timer = 0, ro = null;
    const stop = () => { ctl.abort(); ro?.disconnect(); clearTimeout(timer); if (restoreStop === stop) restoreStop = null; };
    const attempt = () => { window.scrollTo(0, y); if (Math.abs(window.scrollY - y) < 2) stop(); };
    restoreStop = stop;
    // Any input from the visitor wins over the restore.
    const sig = AbortSignal.any([signal, ctl.signal]);
    for (const ev of ["wheel", "touchstart", "keydown", "pointerdown"]) window.addEventListener(ev, stop, { signal: sig, passive: true });
    timer = setTimeout(stop, 8000);
    ro = new ResizeObserver(attempt);
    ro.observe($("#view"));
    attempt();
  }

  // Clamped offsets while a restore waits for content must not overwrite the saved one.
  window.addEventListener("scroll", () => { if (entryKey && !restoreStop) SCROLL.set(entryKey, window.scrollY); }, { signal, passive: true });

  // Unknown routes and filter values fall back to the browse view; rewrite the URL to match.
  function sync() {
    restoreStop?.();
    state = readHash();
    openMenu = null;
    if (toHash(state) !== location.hash) history.replaceState(history.state, "", toHash(state));
    const saved = trackEntry();
    render();
    if (saved !== undefined) restoreScroll(saved);
  }
  window.addEventListener("hashchange", sync, { signal });
  sync();

  return () => {
    restoreStop?.();
    ac.abort();
    history.scrollRestoration = prevRestoration;
    closeSuggest();
    observer?.disconnect();
    if (!$("#lightbox").hidden) { $("#lightbox").hidden = true; document.body.style.overflow = ""; }
    if ($("#removal").open) $("#removal").close();
  };
}
