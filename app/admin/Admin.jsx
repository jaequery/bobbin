"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { INDUSTRIES, PAGE_PATTERNS, SECTION_TYPES } from "../../lib/taxonomy";

// The local admin. View state lives in the hash: #/queue, #/discovered,
// #/approved, #/rejected, #/removals, #/seeds and #/site/<id>; anything else
// falls back to the queue. Data comes from app/api/admin/**.
const TABS = [
  ["queue", "Queue"], ["discovered", "Discovered"], ["approved", "Approved"], ["rejected", "Rejected"],
  ["removals", "Removal requests"], ["seeds", "Add seeds"],
];

function readHash() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "site" && /^[\w-]{1,64}$/.test(parts[1] || "")) return { view: "site", id: parts[1] };
  return { view: TABS.some(([k]) => k === parts[0]) ? parts[0] : "queue", id: null };
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api/admin/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) {
    const err = new Error(json?.error?.message || `Request failed (${res.status})`);
    err.fields = json?.error?.fields;
    throw err;
  }
  return json.data;
}

const date = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
const Out = ({ href, children }) => <a href={href} target="_blank" rel="noopener nofollow">{children}</a>;

export default function Admin() {
  const [route, setRoute] = useState({ view: "queue", id: null });
  const [counts, setCounts] = useState({});
  const [jobs, setJobs] = useState([]);
  const [notice, setNotice] = useState(null);
  const [tick, setTick] = useState(0); // bump to reload the current view
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const sync = () => {
      const r = readHash();
      const want = r.view === "site" ? `#/site/${r.id}` : `#/${r.view}`;
      if (location.hash !== want) history.replaceState(null, "", want);
      setRoute(r);
      setNotice(null);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // Jobs: poll every 2s while any is queued or running, and reload the view when one finishes.
  const active = jobs.some((j) => j.status === "queued" || j.status === "running");
  const jobsRef = useRef([]);
  const pollJobs = useCallback(() => api("jobs").then((d) => {
    const wasActive = new Set(jobsRef.current.filter((j) => j.status === "queued" || j.status === "running").map((j) => j.id));
    jobsRef.current = d.items;
    setJobs(d.items);
    if (d.items.some((j) => wasActive.has(j.id) && (j.status === "done" || j.status === "failed"))) reload();
  }, () => {}), [reload]);
  useEffect(() => { pollJobs(); }, [pollJobs, tick]);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(pollJobs, 2000);
    return () => clearInterval(t);
  }, [active, pollJobs]);

  const act = useCallback(async (fn, ok) => {
    setNotice(null);
    try {
      const r = await fn();
      if (ok) setNotice({ kind: "ok", text: typeof ok === "function" ? ok(r) : ok });
      reload();
      pollJobs();
      return r;
    } catch (err) {
      setNotice({ kind: "error", text: err.message });
      throw err;
    }
  }, [reload, pollJobs]);

  const ctx = { tick, act, setCounts, reload };
  return (
    <div className="layout admin">
      <aside className="sidebar" aria-label="Admin">
        <a className="logo" href="/" aria-label="Jethro home">
          <svg viewBox="0 0 46 46" aria-hidden="true">
            <circle cx="23" cy="23" r="20.5" fill="none" stroke="currentColor" strokeWidth="4" />
            <path d="M25.5 13v0.5M25.5 20v9a5 5 0 0 1 -10 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </a>
        <nav className="nav">
          {TABS.map(([key, label]) => (
            <a key={key} className="nav-item" href={`#/${key}`} aria-current={route.view === key ? "page" : undefined}>
              {label}{counts[key] != null && <span className="trail">{counts[key]}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot"><a className="btn-outline" href="/">Open the library</a></div>
      </aside>
      <main className="main">
        <h1 className="admin-title">{route.view === "site" ? "Edit site" : TABS.find(([k]) => k === route.view)[1]}</h1>
        <Jobs jobs={jobs} />
        {notice && <p className={`admin-notice ${notice.kind}`} role="status">{notice.text}</p>}
        {route.view === "site" ? <SiteEdit id={route.id} {...ctx} />
          : route.view === "removals" ? <Removals {...ctx} />
          : route.view === "seeds" ? <Seeds {...ctx} />
          : <SiteList tab={route.view} {...ctx} />}
      </main>
    </div>
  );
}

function Jobs({ jobs }) {
  const shown = jobs.slice(0, 5);
  if (!shown.length) return null;
  return (
    <ul className="admin-jobs" aria-label="Background jobs">
      {shown.map((j) => (
        <li key={j.id}>
          <span className={`chip st-${j.status}`}>{j.status}</span>
          {j.kind === "recapture" ? "Re-capture" : "Re-judge"} <a href={`#/site/${j.siteId}`}>{j.domain}</a>
          <span className="mute">{j.error || (j.finishedAt ? `finished ${date(j.finishedAt)}` : j.startedAt ? `started ${date(j.startedAt)}` : "waiting")}</span>
        </li>
      ))}
    </ul>
  );
}

function Score({ site }) {
  if (site.quality == null) return <span className="mute">{site.captureProblem ? `bad capture: ${site.captureProblem}` : site.lastError || "not judged"}</span>;
  return <><b>{site.quality}</b>/10 <span className="mute">{site.reasons[0] || ""}</span></>;
}

function Thumbs({ thumbs }) {
  return (
    <div className="admin-thumbs">
      {thumbs.desktop ? <img className="d" src={thumbs.desktop.sm} alt="" loading="lazy" /> : <span className="d empty-thumb" />}
      {thumbs.mobile ? <img className="m" src={thumbs.mobile.sm} alt="" loading="lazy" /> : <span className="m empty-thumb" />}
    </div>
  );
}

function SiteList({ tab, tick, act, setCounts }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const ac = new AbortController();
    setError(null);
    fetch(`/api/admin/sites?tab=${tab}&q=${encodeURIComponent(q)}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((j) => { if (j.error) throw new Error(j.error.message); setData(j.data); setCounts(j.data.counts); })
      .catch((err) => { if (!ac.signal.aborted) setError(err.message); });
    return () => ac.abort();
  }, [tab, q, tick, setCounts]);

  const setStatus = (s, status) => act(() => api(`sites/${s.id}`, { method: "PATCH", body: { status } }), `${s.domain} ${status}`);

  return (
    <>
      <label className="search admin-search">
        <span className="sr-only">Filter by domain or name</span>
        <input type="search" placeholder="Filter by domain or name" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {error && <p className="admin-notice error">{error}</p>}
      {data && !data.items.length && <div className="empty"><h2>Nothing here</h2><div>No sites in this tab.</div></div>}
      {data?.items.length > 0 && (
        <table className="admin-table">
          <thead><tr><th>Screens</th><th>Site</th><th>Score</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {data.items.map((s) => (
              <tr key={s.id}>
                <td><a href={`#/site/${s.id}`}><Thumbs thumbs={s.thumbs} /></a></td>
                <td>
                  <a className="admin-name" href={`#/site/${s.id}`}>{s.name || s.domain}</a>
                  <div><Out href={s.url}>{s.domain} ↗</Out>{s.industry && <span className="mute"> · {s.industry}</span>}{s.country && <span className="mute"> · {s.country}</span>}</div>
                </td>
                <td className="admin-score"><Score site={s} /></td>
                <td>
                  <span className={`chip st-${s.status}`}>{s.status}</span>
                  {s.optout && s.optout !== "dismissed" && <span className="chip">removal {s.optout}</span>}
                  {s.job && <span className="chip st-running">job</span>}
                </td>
                <td><div className="admin-actions">
                  {s.status !== "approved" && <button className="btn-small" type="button" onClick={() => setStatus(s, "approved")}>Approve</button>}
                  {s.status !== "rejected" && <button className="btn-small" type="button" onClick={() => setStatus(s, "rejected")}>Reject</button>}
                  <a className="btn-small" href={`#/site/${s.id}`}>Edit</a>
                </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function SiteEdit({ id, tick, act }) {
  const [site, setSite] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({});
  const [patterns, setPatterns] = useState({});
  const [types, setTypes] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const loadedFor = useRef(null);

  useEffect(() => {
    let live = true;
    api(`sites/${id}`).then((s) => {
      if (!live) return;
      setSite(s);
      // Keep unsaved edits when a job finishing reloads the same site.
      if (loadedFor.current !== id) {
        loadedFor.current = id;
        setForm({ name: s.name || "", tagline: s.tagline || "", industry: s.industry || "", country: s.country || "" });
        setPatterns({});
        setTypes({});
      }
    }, (err) => live && setError(err.message));
    return () => { live = false; };
  }, [id, tick]);

  if (error) return <div className="empty"><h2>Couldn’t load the site</h2><div>{error}</div><a className="btn-outline" href="#/queue">Back to the queue</a></div>;
  if (!site) return <p className="mute">Loading…</p>;

  const busy = !!site.job || ["queued", "capturing", "judging"].includes(site.status);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = (extra = {}) => {
    setFieldErrors({});
    const body = {
      ...form, ...extra,
      pages: Object.entries(patterns).map(([pid, pattern]) => ({ id: pid, pattern })),
      sections: Object.entries(types).map(([sid, type]) => ({ id: sid, type })),
    };
    return act(() => api(`sites/${id}`, { method: "PATCH", body }), extra.status ? `${site.domain} ${extra.status}` : "Saved")
      .then(() => { setPatterns({}); setTypes({}); }, (err) => setFieldErrors(err.fields || {}));
  };
  const job = (kind) => act(() => api(`sites/${id}/${kind}`, { method: "POST" }), `${kind === "recapture" ? "Re-capture" : "Re-judge"} queued for ${site.domain}`).catch(() => {});
  const del = () => {
    if (!confirm(`Delete ${site.domain} and all its screenshots? It can be rediscovered later unless it has opted out.`)) return;
    act(() => api(`sites/${id}`, { method: "DELETE" }), `${site.domain} deleted`).then(() => { location.hash = "#/queue"; }, () => {});
  };

  return (
    <div className="admin-edit">
      <a className="back" href={`#/${site.status === "approved" ? "approved" : site.status === "rejected" ? "rejected" : site.status === "discovered" ? "discovered" : "queue"}`}>← Back</a>
      <div className="admin-head">
        <div>
          <h2>{site.name || site.domain}</h2>
          <p><Out href={site.url}>{site.domain} ↗</Out> · <span className={`chip st-${site.status}`}>{site.status}</span>
            {site.optout && <span className="chip">removal {site.optout.status}</span>}
            {site.job && <span className="chip st-running">{site.job.kind} {site.job.status}</span>}</p>
          <p className="mute">Captured {date(site.capturedAt)} · judged {date(site.judgedAt)} · source {site.source || "—"}{site.lastError ? ` · last error ${site.lastError}` : ""}</p>
        </div>
        <div className="admin-actions">
          <button className="btn-small" type="button" disabled={busy || site.status === "approved"} onClick={() => save({ status: "approved" })}>Approve</button>
          <button className="btn-small" type="button" disabled={busy || site.status === "rejected"} onClick={() => save({ status: "rejected" })}>Reject</button>
          <button className="btn-small" type="button" disabled={busy} onClick={() => job("recapture")}>Re-capture</button>
          <button className="btn-small" type="button" disabled={busy} onClick={() => job("rejudge")}>Re-judge</button>
          <button className="btn-small danger" type="button" disabled={busy} onClick={del}>Delete</button>
        </div>
      </div>

      <section className="admin-card">
        <h3>Judgement</h3>
        <p><Score site={site} /></p>
        {site.scores && <p className="mute">{Object.entries(site.scores).map(([k, v]) => `${k} ${v}`).join(" · ")}</p>}
        {site.reasons.length > 1 && <ul className="admin-reasons">{site.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
      </section>

      <form className="admin-card admin-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <h3>Details</h3>
        <label>Name<input value={form.name ?? ""} onChange={set("name")} maxLength={120} /></label>
        <label>Tagline<input value={form.tagline ?? ""} onChange={set("tagline")} maxLength={200} /></label>
        <label>Industry
          <select value={form.industry ?? ""} onChange={set("industry")}>
            <option value="">—</option>
            {INDUSTRIES.map((v) => <option key={v}>{v}</option>)}
          </select>
          {fieldErrors.industry && <small className="err">{fieldErrors.industry}</small>}
        </label>
        <label>Country<input value={form.country ?? ""} onChange={set("country")} maxLength={2} placeholder="DE" />
          {fieldErrors.country && <small className="err">{fieldErrors.country}</small>}
        </label>
        <button className="btn-primary" type="submit">Save changes</button>
      </form>

      {site.pages.map((p) => (
        <section className="admin-card" key={p.id}>
          <div className="admin-page-head">
            <h3>{p.path}</h3>
            <label className="inline">Pattern
              <select value={patterns[p.id] ?? p.pattern ?? ""} onChange={(e) => setPatterns((m) => ({ ...m, [p.id]: e.target.value }))}>
                {!p.pattern && <option value="">—</option>}
                {PAGE_PATTERNS.map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
            {p.url && <Out href={p.url}>open page ↗</Out>}
          </div>
          <div className="admin-shots">
            {p.screens.map((sc) => (
              <a key={sc.id} className={`admin-shot ${sc.platform}`} href={sc.full} target="_blank" rel="noopener">
                <img src={sc.sm} alt={`${p.path} ${sc.platform}`} loading="lazy" />
                <span className="mute">{sc.platform} · {date(sc.capturedAt)}</span>
              </a>
            ))}
          </div>
          {p.sections.length > 0 && (
            <div className="admin-sections">
              {p.sections.map((x) => (
                <figure key={x.id}>
                  <img src={x.sm} alt={`${x.type || "section"} ${x.platform}`} loading="lazy" />
                  <figcaption>
                    <select aria-label="Section type" value={types[x.id] ?? x.type ?? ""} onChange={(e) => setTypes((m) => ({ ...m, [x.id]: e.target.value }))}>
                      {!x.type && <option value="">—</option>}
                      {SECTION_TYPES.map((v) => <option key={v}>{v}</option>)}
                    </select>
                    <span className="mute">{x.platform}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      ))}
      {(Object.keys(patterns).length > 0 || Object.keys(types).length > 0) && (
        <div className="admin-savebar"><span>{Object.keys(patterns).length + Object.keys(types).length} unsaved tag changes</span><button className="btn-primary" type="button" onClick={() => save()}>Save tags</button></div>
      )}

      <section className="admin-card">
        <h3>Recent events</h3>
        <ul className="admin-events">{site.events.map((e, i) => <li key={i}><span className="mute">{date(e.at)}</span> {e.kind}</li>)}</ul>
      </section>
    </div>
  );
}

function Removals({ tick, act }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let live = true;
    api("optouts").then((d) => live && setItems(d.items), (err) => live && setError(err.message));
    return () => { live = false; };
  }, [tick]);
  const decide = (o, status) => {
    if (status === "approved" && o.siteId && !confirm(`Delete ${o.domain} and all its screenshots for good?`)) return;
    act(() => api("optouts", { method: "PATCH", body: { domain: o.domain, status } }), `${o.domain}: removal ${status}`).catch(() => {});
  };
  if (error) return <p className="admin-notice error">{error}</p>;
  if (!items) return <p className="mute">Loading…</p>;
  if (!items.length) return <div className="empty"><h2>No removal requests</h2></div>;
  return (
    <table className="admin-table">
      <thead><tr><th>Domain</th><th>Contact</th><th>Reason</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
      <tbody>
        {items.map((o) => (
          <tr key={o.domain}>
            <td><b>{o.domain}</b><div className="mute">{o.siteId ? <a href={`#/site/${o.siteId}`}>in library ({o.siteStatus})</a> : "not in library"}</div></td>
            <td>{o.email || "—"}<div className="mute">{date(o.createdAt)}</div></td>
            <td className="admin-reason">{o.reason || <span className="mute">—</span>}</td>
            <td><span className={`chip st-${o.status}`}>{o.status}</span></td>
            <td><div className="admin-actions">
              {o.status !== "approved" && <button className="btn-small danger" type="button" onClick={() => decide(o, "approved")}>Approve removal</button>}
              {o.status !== "dismissed" && <button className="btn-small" type="button" onClick={() => decide(o, "dismissed")}>Dismiss</button>}
                </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Seeds({ act }) {
  const [urls, setUrls] = useState("");
  const [results, setResults] = useState(null);
  const submit = (e) => {
    e.preventDefault();
    act(() => api("seeds", { method: "POST", body: { urls } }), (r) => `${r.results.filter((x) => x.result === "inserted").length} of ${r.results.length} added`)
      .then((r) => { setResults(r.results); setUrls(""); }, () => {});
  };
  return (
    <form className="admin-card admin-form" onSubmit={submit}>
      <label>One URL per line; # starts a comment. New sites go in as <i>discovered</i> for the next pipeline run.
        <textarea rows={8} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder={"https://example.com\nhttps://another.example"} />
      </label>
      <button className="btn-primary" type="submit">Add seeds</button>
      {results && (
        <ul className="admin-events">
          {results.map((r, i) => <li key={i}><span className={`chip ${r.result === "inserted" ? "st-approved" : ""}`}>{r.result === "inserted" ? "added" : r.result === "known" ? "already known" : "refused"}</span> {r.url}{!["inserted", "known"].includes(r.result) && <span className="mute"> — {r.result}</span>}</li>)}
        </ul>
      )}
    </form>
  );
}
