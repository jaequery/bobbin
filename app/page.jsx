import Bobbin from "./Bobbin";

export default function Page() {
  return (
    <>
      <div className="layout">
        <aside className="sidebar" aria-label="Primary">
          <a className="logo" href="#/apps" aria-label="Bobbin home">
            <svg viewBox="0 0 46 46" aria-hidden="true">
              <circle cx="23" cy="23" r="20.5" fill="none" stroke="#111" strokeWidth="4" />
              <path d="M16.5 12.5v21M16.5 25.5a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0 -13 0" fill="none" stroke="#111" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </a>
          <nav className="nav" id="nav"></nav>
          <div className="sidebar-foot">
            <button className="nav-item" id="about-btn" type="button"></button>
            <button className="btn-outline" id="reset-btn" type="button"></button>
          </div>
        </aside>

        <main className="main">
          <label className="search">
            <span className="sr-only">Search apps or UI patterns</span>
            <input id="q" type="search" autoComplete="off" placeholder="Search apps or patterns — try “Checkout”" />
            <button className="clear-q" id="clear-q" type="button" aria-label="Clear search" hidden></button>
            <span className="kbd" id="search-icon" aria-hidden="true"></span>
          </label>
          <div className="toolbar" id="toolbar"></div>
          <section className="view" id="view" aria-live="polite"></section>
        </main>
      </div>

      <div className="lightbox" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="Screen viewer"></div>

      <dialog id="about">
        <h2>About Bobbin</h2>
        <p>Bobbin is an open library of app screens for product designers. Browse by app or by screen, search by app name or UI pattern, and filter by platform, pattern and industry.</p>
        <p>Every app and screenshot here is an original placeholder.</p>
        <form method="dialog"><button className="btn-primary">Got it</button></form>
      </dialog>

      <Bobbin />
    </>
  );
}
