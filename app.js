(() => {
  const { PLATFORMS, PATTERNS, INDUSTRIES, apps, screens } = window.BOBBIN_DATA;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Icons (inline line icons) ----------
  const ICON = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    Web: '<rect x="3.5" y="5" width="17" height="11.5" rx="2"/><path d="M2 19h20"/>',
    iOS: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    Android: '<rect x="6.5" y="2.5" width="11" height="19" rx="2"/><path d="M6.5 6h11M6.5 18h11"/>',
    layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
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
  };
  const icon = (name, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

  // ---------- Placeholder screenshots (procedural SVG) ----------
  function blocks(p, W, H, c, c2) {
    const r = (x, y, w, h, f, rx = 6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}"/>`;
    const g = "#E7E5E4", t = "#1C1917", m = "#A8A29E";
    const pad = W * 0.08, cw = W - pad * 2;
    let s = "";
    const lines = (y, n) => { for (let k = 0; k < n; k++) s += r(pad, y + k * H * 0.035, cw * (k % 2 ? 0.7 : 0.92), H * 0.016, g, 3); };
    switch (p) {
      case "Onboarding":
        s += `<circle cx="${W / 2}" cy="${H * 0.33}" r="${Math.min(W, H) * 0.2}" fill="${c2}"/><circle cx="${W / 2}" cy="${H * 0.33}" r="${Math.min(W, H) * 0.1}" fill="${c}"/>`;
        s += r(pad * 1.6, H * 0.56, cw * 0.8, H * 0.03, t, 4); lines(H * 0.62, 2);
        s += [-14, 0, 14].map((dx, k) => `<circle cx="${W / 2 + dx}" cy="${H * 0.78}" r="4" fill="${k ? g : c}"/>`).join("");
        s += r(pad, H * 0.85, cw, H * 0.065, c, 12); break;
      case "Sign up":
        s += r(pad, H * 0.14, cw * 0.6, H * 0.035, t, 4); lines(H * 0.2, 1);
        for (let k = 0; k < 3; k++) s += `<rect x="${pad}" y="${H * (0.3 + k * 0.1)}" width="${cw}" height="${H * 0.065}" rx="10" fill="#fff" stroke="${g}" stroke-width="2"/>`;
        s += r(pad, H * 0.66, cw, H * 0.065, c, 12) + r(pad, H * 0.76, cw, H * 0.065, c2, 12); break;
      case "Home":
        s += r(pad, H * 0.08, cw * 0.5, H * 0.03, t, 4) + r(pad, H * 0.14, cw, H * 0.2, c, 12) + r(pad + 10, H * 0.2, cw * 0.4, H * 0.025, "#ffffff99", 4);
        for (let k = 0; k < 3; k++) {
          const y = H * (0.39 + k * 0.12), sz = H * 0.09;
          s += r(pad, y, sz, sz, c2, 10) + r(pad + sz * 1.2, y + H * 0.015, cw * 0.5, H * 0.018, t, 3) + r(pad + sz * 1.2, y + H * 0.05, cw * 0.35, H * 0.014, m, 3);
        }
        s += `<line x1="0" y1="${H * 0.9}" x2="${W}" y2="${H * 0.9}" stroke="${g}"/>`;
        for (let k = 0; k < 4; k++) s += `<circle cx="${W * (0.15 + k * 0.233)}" cy="${H * 0.95}" r="7" fill="${k ? g : c}"/>`;
        break;
      case "Search":
        s += r(pad, H * 0.08, cw, H * 0.06, "#F5F5F4", 20) + `<circle cx="${pad + 18}" cy="${H * 0.11}" r="6" fill="none" stroke="${m}" stroke-width="2"/>`;
        for (let k = 0; k < 3; k++) s += r(pad + k * (cw * 0.26), H * 0.17, cw * 0.23, H * 0.035, k ? c2 : c, 20);
        for (let k = 0; k < 2; k++) for (let l = 0; l < 2; l++) s += r(pad + l * (cw * 0.52), H * (0.25 + k * 0.3), cw * 0.48, H * 0.2, k + l ? c2 : c, 10) + r(pad + l * (cw * 0.52), H * (0.47 + k * 0.3), cw * 0.35, H * 0.018, t, 3);
        break;
      case "Checkout":
        s += r(pad, H * 0.08, cw * 0.45, H * 0.03, t, 4);
        for (let k = 0; k < 2; k++) {
          const y = H * (0.15 + k * 0.11), sz = H * 0.08;
          s += r(pad, y, sz, sz, c2, 8) + r(pad + sz * 1.25, y + H * 0.015, cw * 0.45, H * 0.018, t, 3) + r(W - pad - cw * 0.18, y + H * 0.015, cw * 0.18, H * 0.018, t, 3);
        }
        s += `<line x1="${pad}" y1="${H * 0.4}" x2="${W - pad}" y2="${H * 0.4}" stroke="${g}" stroke-width="2"/>`; lines(H * 0.44, 3);
        s += r(pad, H * 0.6, cw, H * 0.09, "#F5F5F4", 10) + r(pad + 12, H * 0.63, cw * 0.3, H * 0.025, c, 4) + r(pad, H * 0.84, cw, H * 0.07, c, 12); break;
      case "Settings":
        s += r(pad, H * 0.08, cw * 0.4, H * 0.03, t, 4);
        for (let k = 0; k < 7; k++) {
          const y = H * (0.15 + k * 0.1), tw = Math.min(W * 0.14, 44), th = H * 0.035, on = k % 3 === 0;
          s += r(pad, y + H * 0.01, cw * 0.55, H * 0.018, t, 3) + r(W - pad - tw, y, tw, th, on ? c : g, 20);
          s += `<circle cx="${on ? W - pad - th / 2 : W - pad - tw + th / 2}" cy="${y + th / 2}" r="${th * 0.4}" fill="#fff"/><line x1="${pad}" y1="${y + H * 0.06}" x2="${W - pad}" y2="${y + H * 0.06}" stroke="${g}"/>`;
        }
        break;
      case "Profile":
        s += r(0, 0, W, H * 0.22, c2, 0) + `<circle cx="${W / 2}" cy="${H * 0.22}" r="${Math.min(W, H) * 0.12}" fill="${c}" stroke="#fff" stroke-width="4"/>`;
        s += r(W / 2 - cw * 0.25, H * 0.34, cw * 0.5, H * 0.028, t, 4) + r(W / 2 - cw * 0.17, H * 0.39, cw * 0.34, H * 0.016, m, 3);
        for (let k = 0; k < 3; k++) s += r(pad + k * (cw * 0.34), H * 0.44, cw * 0.3, H * 0.07, "#F5F5F4", 8);
        for (let k = 0; k < 3; k++) for (let l = 0; l < 3; l++) s += r(pad + l * (cw * 0.34), H * (0.54 + k * 0.13), cw * 0.32, H * 0.12, (k + l) % 2 ? c2 : c, 6);
        break;
      default: // Empty state
        s += `<circle cx="${W / 2}" cy="${H * 0.4}" r="${Math.min(W, H) * 0.18}" fill="${c2}"/>` + r(W / 2 - W * 0.06, H * 0.37, W * 0.12, H * 0.06, c, 6);
        s += r(pad * 1.8, H * 0.6, cw * 0.75, H * 0.028, t, 4); lines(H * 0.66, 2);
        s += r(W / 2 - cw * 0.3, H * 0.78, cw * 0.6, H * 0.06, c, 12);
    }
    return s;
  }

  function screenSVG(sc) {
    const { app } = sc;
    const label = `${esc(app.name)} — ${esc(sc.pattern)} (placeholder screen)`;
    if (app.platform === "Web") {
      const W = 640, H = 400, bar = 28, side = 128;
      const nav = [0, 1, 2, 3, 4].map((k) => `<rect x="16" y="${bar + 22 + k * 30}" width="${side - 32}" height="12" rx="4" fill="${k ? "#ffffff" : app.c}"/>`).join("");
      return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}" preserveAspectRatio="xMidYMid slice"><rect width="${W}" height="${H}" fill="#fff"/><rect width="${W}" height="${bar}" fill="#FAFAF9"/><circle cx="14" cy="14" r="4" fill="#E7E5E4"/><circle cx="28" cy="14" r="4" fill="#E7E5E4"/><circle cx="42" cy="14" r="4" fill="#E7E5E4"/><rect x="0" y="${bar}" width="${side}" height="${H - bar}" fill="${app.c2}"/>${nav}<g transform="translate(${side + 40},${bar})">${blocks(sc.pattern, W - side - 80, H - bar, app.c, app.c2)}</g></svg>`;
    }
    const W = 300, H = 650;
    const notch = app.platform === "iOS"
      ? `<rect x="${W / 2 - 40}" y="12" width="80" height="20" rx="10" fill="#1C1917"/>`
      : `<circle cx="${W / 2}" cy="20" r="7" fill="#1C1917"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}" preserveAspectRatio="xMidYMid slice"><rect width="${W}" height="${H}" fill="#fff"/>${notch}${blocks(sc.pattern, W, H, app.c, app.c2)}</svg>`;
  }

  const logo = (app) => `<span class="app-logo" aria-hidden="true">${esc(app.name[0])}<i style="background:${app.c}"></i></span>`;

  // ---------- State <-> hash ----------
  const EMPTY = { q: "", platform: "", pattern: "", industry: "" };
  let state = { view: "apps", appId: null, ...EMPTY };

  function readHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, query = ""] = raw.split("?");
    const params = new URLSearchParams(query);
    const parts = path.split("/").filter(Boolean);
    const next = { view: "apps", appId: null, ...EMPTY };
    if (parts[0] === "screens") next.view = "screens";
    else if (parts[0] === "app" && apps.some((a) => a.id === parts[1])) { next.view = "app"; next.appId = parts[1]; }
    for (const k of Object.keys(EMPTY)) next[k] = params.get(k) || "";
    // Ignore unknown filter values rather than showing an impossible empty state.
    if (!PLATFORMS.includes(next.platform)) next.platform = "";
    if (!PATTERNS.includes(next.pattern)) next.pattern = "";
    if (!INDUSTRIES.includes(next.industry)) next.industry = "";
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
    if (replace) { history.replaceState(null, "", hash); state = next; render(); }
    else location.hash = hash; // hashchange renders
  }

  // ---------- Filtering ----------
  function matches(sc, s, { ignore } = {}) {
    const q = s.q.trim().toLowerCase();
    if (q && !(sc.app.name.toLowerCase().includes(q) || sc.pattern.toLowerCase().includes(q))) return false;
    if (ignore !== "platform" && s.platform && sc.app.platform !== s.platform) return false;
    if (ignore !== "pattern" && s.pattern && sc.pattern !== s.pattern) return false;
    if (ignore !== "industry" && s.industry && sc.app.industry !== s.industry) return false;
    return true;
  }
  const filteredScreens = (s, opts) => screens.filter((sc) => matches(sc, s, opts));
  const filteredApps = (s) => apps.filter((a) => a.screens.some((sc) => matches(sc, s)));
  const hasFilters = (s) => Boolean(s.q.trim() || s.platform || s.pattern || s.industry);

  // ---------- Sidebar ----------
  function renderSidebar() {
    const plat = [["", "All apps", "grid"], ["Web", "Web apps", "Web"], ["iOS", "iOS apps", "iOS"], ["Android", "Android apps", "Android"]];
    $("#nav").innerHTML =
      `<button class="btn-primary" type="button" data-action="new-search">${icon("plus")}New search</button>` +
      plat.map(([val, label, ic]) =>
        `<button class="nav-item" type="button" data-platform="${val}" ${state.platform === val && state.view !== "app" ? 'aria-current="page"' : ""}>${icon(ic)}${label}</button>`
      ).join("");
    $("#about-btn").innerHTML = `${icon("info")}About Bobbin`;
    $("#reset-btn").innerHTML = `${icon("reset")}Reset filters`;
  }

  // ---------- Toolbar ----------
  let openMenu = null;
  function menuPill(key, label, ic, options) {
    const val = state[key];
    const counts = Object.fromEntries(options.map((o) => [o, filteredScreens({ ...state, [key]: o }, {}).length]));
    const menu = openMenu === key
      ? `<div class="menu" role="menu" aria-label="${label}">` +
        `<button role="menuitemradio" aria-checked="${!val}" data-set="${key}" data-val="">Any ${label.toLowerCase()}</button>` +
        options.map((o) => `<button role="menuitemradio" aria-checked="${val === o}" data-set="${key}" data-val="${esc(o)}">${esc(o)}<small>${counts[o]}</small></button>`).join("") +
        `</div>`
      : "";
    const clear = val ? `<span class="x" role="button" tabindex="0" aria-label="Clear ${label}" data-set="${key}" data-val="">${icon("x", "i chev")}</span>` : icon("chev", "i chev");
    return `<span style="position:relative"><button class="pill ${val ? "is-set" : ""}" type="button" aria-haspopup="menu" aria-expanded="${openMenu === key}" data-menu="${key}">${icon(ic)}${esc(val || label)}${clear}</button>${menu}</span>`;
  }

  function renderToolbar() {
    const tb = $("#toolbar");
    if (state.view === "app") {
      const app = apps.find((a) => a.id === state.appId);
      const present = PATTERNS.filter((p) => app.screens.some((s) => s.pattern === p));
      tb.innerHTML =
        `<button class="pill" type="button" aria-pressed="${!state.pattern}" data-set="pattern" data-val="">${icon("layers")}All screens</button>` +
        present.map((p) => `<button class="pill" type="button" aria-pressed="${state.pattern === p}" data-set="pattern" data-val="${esc(p)}">${esc(p)}</button>`).join("");
      return;
    }
    const n = state.view === "apps" ? filteredApps(state).length : filteredScreens(state).length;
    tb.innerHTML =
      `<button class="pill" type="button" aria-pressed="${state.view === "apps"}" data-view="apps">${icon("grid")}Apps</button>` +
      `<button class="pill" type="button" aria-pressed="${state.view === "screens"}" data-view="screens">${icon("layers")}Screens</button>` +
      `<span class="sep" aria-hidden="true"></span>` +
      menuPill("pattern", "UI pattern", "pattern", PATTERNS) +
      menuPill("industry", "Industry", "industry", INDUSTRIES) +
      `<span class="count">${n} ${state.view === "apps" ? (n === 1 ? "app" : "apps") : (n === 1 ? "screen" : "screens")}</span>`;
  }

  // ---------- Views ----------
  function appCard(app, shown) {
    const pool = shown.length ? shown : app.screens;
    // Lead with the Home screen when nothing narrows the list; it reads best as a cover.
    const home = pool.findIndex((s) => s.pattern === "Home");
    const list = home > 0 ? [pool[home], ...pool.filter((_, i) => i !== home)] : pool;
    const inner = app.platform === "Web"
      ? `<div class="shot-web">${screenSVG(list[0])}</div>`
      : `<div class="shot-row">${list.slice(0, 3).map((s) => `<div>${screenSVG(s)}</div>`).join("")}</div>`;
    return `<a class="app-card" href="${toHash({ ...state, view: "app", appId: app.id, q: "", platform: "", industry: "" })}" aria-label="${esc(app.name)}, ${esc(app.platform)}, ${esc(app.industry)}">
      <div class="frame" style="--t1:${app.tone[0]};--t2:${app.tone[1]}">${inner}</div>
      <div class="meta">${logo(app)}<div><div class="name">${esc(app.name)}</div><div class="tag">${esc(app.tagline)}</div></div></div>
    </a>`;
  }

  function screenCard(sc, i, showApp = true) {
    return `<button class="screen-card ${sc.app.platform === "Web" ? "web" : ""}" type="button" data-shot="${i}">
      <div class="tile"><div>${screenSVG(sc)}</div></div>
      <div class="cap">${showApp ? `${logo(sc.app)}<b>${esc(sc.app.name)}</b>` : ""}<span>${esc(sc.pattern)}</span></div>
    </button>`;
  }

  function emptyState() {
    return `<div class="empty"><h2>No matches</h2><div>Nothing fits “${esc(state.q.trim() || "these filters")}”. Try a different pattern or clear your filters.</div><button class="btn-outline" type="button" data-action="reset">${icon("reset")}Clear filters</button></div>`;
  }

  let lightboxList = [];
  function renderView() {
    const view = $("#view");
    if (state.view === "apps") {
      const list = filteredApps(state);
      lightboxList = [];
      view.innerHTML = list.length
        ? `<div class="app-grid">${list.map((a) => appCard(a, a.screens.filter((sc) => matches(sc, state)))).join("")}</div>`
        : emptyState();
    } else if (state.view === "screens") {
      lightboxList = filteredScreens(state);
      view.innerHTML = lightboxList.length
        ? `<div class="screen-grid">${lightboxList.map((sc, i) => screenCard(sc, i)).join("")}</div>`
        : emptyState();
    } else {
      const app = apps.find((a) => a.id === state.appId);
      lightboxList = app.screens.filter((sc) => !state.pattern || sc.pattern === state.pattern);
      view.innerHTML = `
        <button class="back" type="button" data-action="back">${icon("back")}All apps</button>
        <div class="detail-head">${logo(app)}<div><h1>${esc(app.name)}</h1><p>${esc(app.tagline)}</p></div></div>
        <div class="facts"><span class="fact">${esc(app.platform)}</span><span class="fact">${esc(app.industry)}</span><span class="fact">${app.screens.length} screens</span></div>
        <div class="screen-grid">${lightboxList.map((sc, i) => screenCard(sc, i, false)).join("")}</div>`;
    }
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
    const sc = lightboxList[lbIndex];
    if (!sc) return closeLightbox();
    $("#lightbox").innerHTML = `
      <div class="lb-bar">${logo(sc.app)}<div><b>${esc(sc.app.name)}</b><br><span>${esc(sc.pattern)} · ${esc(sc.app.platform)} · ${lbIndex + 1} of ${lightboxList.length}</span></div>
        <span class="spacer"></span><button class="lb-btn" type="button" data-lb="close" aria-label="Close viewer">${icon("x")}</button></div>
      <div class="lb-stage">
        <button class="lb-btn" type="button" data-lb="prev" aria-label="Previous screen" ${lbIndex === 0 ? "disabled" : ""}>${icon("left")}</button>
        <div class="lb-shot ${sc.app.platform === "Web" ? "web" : ""}"><div>${screenSVG(sc)}</div></div>
        <button class="lb-btn" type="button" data-lb="next" aria-label="Next screen" ${lbIndex === lightboxList.length - 1 ? "disabled" : ""}>${icon("right")}</button>
      </div>`;
  }
  function stepLightbox(d) {
    const n = lbIndex + d;
    if (n < 0 || n >= lightboxList.length) return;
    lbIndex = n; renderLightbox(); $("#lightbox [data-lb=close]").focus();
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

  function reset() { openMenu = null; go({ ...EMPTY, view: state.view === "app" ? "apps" : state.view, appId: null }); }

  // ---------- Events ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-action],[data-platform],[data-view],[data-set],[data-menu],[data-shot],[data-lb]");
    if (!t) { if (openMenu) { openMenu = null; renderToolbar(); } return; }
    const d = t.dataset;
    if (d.lb) { if (d.lb === "close") closeLightbox(); else stepLightbox(d.lb === "next" ? 1 : -1); return; }
    if (d.shot !== undefined) { openLightbox(Number(d.shot)); return; }
    if (d.action === "new-search") { openMenu = null; go({ ...EMPTY, view: state.view === "app" ? "screens" : state.view, appId: null }); $("#q").focus(); return; }
    if (d.action === "reset") { reset(); return; }
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
  });

  $("#about-btn").addEventListener("click", () => $("#about").showModal());
  $("#reset-btn").addEventListener("click", reset);
  $("#clear-q").addEventListener("click", () => { go({ q: "" }, { replace: true }); $("#q").focus(); });

  $("#q").addEventListener("input", (e) => {
    const patch = { q: e.target.value };
    if (state.view === "app") { patch.view = "screens"; patch.appId = null; patch.pattern = ""; }
    go(patch, { replace: state.view !== "app" });
  });

  document.addEventListener("keydown", (e) => {
    if (!$("#lightbox").hidden) {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowRight") stepLightbox(1);
      else if (e.key === "ArrowLeft") stepLightbox(-1);
      else if (e.key === "Tab") { // keep focus inside the viewer
        const f = [...$("#lightbox").querySelectorAll("button:not([disabled])")];
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
      return;
    }
    if (openMenu && e.key === "Escape") { const k = openMenu; openMenu = null; renderToolbar(); document.querySelector(`[data-menu="${k}"]`).focus(); return; }
    if (openMenu && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      const items = [...document.querySelectorAll(".menu button")];
      const i = items.indexOf(document.activeElement);
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
      return;
    }
    if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $("#q").focus(); }
  });

  // Unknown routes and filter values fall back to the browse view; rewrite the URL to match.
  function sync() {
    state = readHash();
    openMenu = null;
    if (toHash(state) !== location.hash) history.replaceState(null, "", toHash(state));
    render();
  }
  window.addEventListener("hashchange", sync);
  sync();
})();
