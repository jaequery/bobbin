// Discovery: pulls candidate sites from galleries, web search and manual seeds,
// normalizes and dedupes them by domain, and inserts new `sites` rows with
// status 'discovered'. One failing adapter never stops the others.
import { getSiteByDomain, upsertSite, recordEvent } from "../../lib/db.js";
import { GALLERIES } from "./galleries/index.js";
import { normalizeCandidate } from "./normalize.js";
import * as search from "./search.js";
import * as seeds from "./seeds.js";

export const SOURCES = ["galleries", "search", "seeds"];

function adaptersFor(sources, only) {
  const list = [];
  if (sources.includes("galleries")) list.push(...GALLERIES);
  if (sources.includes("search")) list.push(search);
  if (sources.includes("seeds")) list.push(seeds);
  return only ? list.filter((a) => a.name === only) : list;
}

// Pulls from every adapter in turn until `limit` candidates are found, so one
// slow or exhausted gallery does not starve the rest.
async function* interleave(adapters, opts) {
  const live = adapters.map((a) => ({ name: a.name, it: a.listing(opts)[Symbol.asyncIterator]() }));
  let found = 0;
  while (live.length && found < opts.limit) {
    for (const entry of [...live]) {
      if (found >= opts.limit) return;
      let step;
      try {
        step = await entry.it.next();
      } catch (err) {
        console.warn(`[${entry.name}] failed, skipping the rest of it: ${err.message}`);
        live.splice(live.indexOf(entry), 1);
        continue;
      }
      if (step.done) {
        live.splice(live.indexOf(entry), 1);
        continue;
      }
      found++;
      yield { adapter: entry.name, ...step.value };
    }
  }
}

// Stores one candidate. Returns "inserted", "known" or the refusal reason.
export async function addCandidate(candidate, source) {
  const norm = await normalizeCandidate(candidate.url, { allowHosted: source !== "search" });
  if (norm.refused) return norm.refused;
  if (getSiteByDomain(norm.domain)) return "known";
  const site = upsertSite({
    domain: norm.domain,
    url: norm.url,
    name: candidate.name || null,
    industry: candidate.industryHint || null,
    country: candidate.countryHint || null,
    status: "discovered",
    source,
    sourceRef: candidate.sourceRef || null,
  });
  recordEvent(site.id, "discovered", { source, sourceRef: candidate.sourceRef || null, from: candidate.url });
  return "inserted";
}

// sources: subset of SOURCES; only: a single adapter name; limit: max candidates
// read across all adapters. Returns { found, inserted, skipped }.
export async function discover({ sources = SOURCES, only, limit = 200, maxQueries, urls, file, log = console.log } = {}) {
  const adapters = adaptersFor(sources, only);
  if (!adapters.length) throw new Error(`no adapter matches ${only ? `--only ${only}` : sources.join(", ")}`);
  const counts = { found: 0, inserted: 0, skipped: 0 };
  const perAdapter = {};
  for await (const candidate of interleave(adapters, { limit, maxQueries, urls, file })) {
    counts.found++;
    const tally = (perAdapter[candidate.adapter] ??= { found: 0, inserted: 0 });
    tally.found++;
    const result = await addCandidate(candidate, candidate.adapter).catch((err) => err.message);
    if (result === "inserted") {
      counts.inserted++;
      tally.inserted++;
    } else {
      counts.skipped++;
      if (result !== "known") log(`  skip ${candidate.url}: ${result}`);
    }
  }
  for (const [name, t] of Object.entries(perAdapter)) log(`[${name}] found ${t.found}, inserted ${t.inserted}`);
  return counts;
}
