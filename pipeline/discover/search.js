// Web search discovery through the Brave Search API (BRAVE_API_KEY). Queries
// come from INDUSTRIES × templates, plus country variants for worldwide coverage.
import { INDUSTRIES } from "../../lib/taxonomy.js";
import { fetchJson } from "./http.js";

export const name = "search";

const TEMPLATES = ["best designed {industry} website", "{industry} landing page design award"];

// Brave's `country` codes; the hint stored on the site is the same ISO code.
const COUNTRIES = [
  ["JP", "Japan"], ["DE", "Germany"], ["FR", "France"], ["NL", "Netherlands"], ["SE", "Sweden"],
  ["KR", "Korea"], ["BR", "Brazil"], ["AU", "Australia"], ["GB", "UK"], ["US", "US"],
];

export function buildQueries() {
  const queries = [];
  for (const industry of INDUSTRIES.filter((i) => i !== "Other")) {
    for (const template of TEMPLATES) {
      const q = template.replace("{industry}", industry);
      queries.push({ q, industry, country: null });
      for (const [code, label] of COUNTRIES) queries.push({ q: `${q} ${label}`, industry, country: code });
    }
  }
  return queries;
}

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Runs up to `maxQueries` random queries and yields their results.
export async function* listing({ limit = Infinity, maxQueries = 30 } = {}) {
  const key = process.env.BRAVE_API_KEY;
  if (!key) {
    console.log("[search] skipped: no BRAVE_API_KEY");
    return;
  }
  let yielded = 0;
  for (const { q, industry, country } of shuffle(buildQueries()).slice(0, maxQueries)) {
    const params = new URLSearchParams({ q, count: "20", safesearch: "strict" });
    if (country) params.set("country", country);
    let data;
    try {
      data = await fetchJson(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: { "x-subscription-token": key },
      });
    } catch (err) {
      console.warn(`[search] "${q}" failed: ${err.message}`);
      continue;
    }
    for (const r of data.web?.results ?? []) {
      if (yielded >= limit) return;
      yielded++;
      yield { url: r.url, name: r.profile?.name || null, industryHint: industry, countryHint: country, sourceRef: `brave:${q}` };
    }
  }
}
