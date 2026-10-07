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

// Pulls from every adapter in turn, so one slow or exhausted gallery does not
// starve the rest. The caller stops it once it has what it needs.
async function* interleave(adapters, opts) {
  const live = adapters.map((a) => ({ name: a.name, it: a.listing(opts)[Symbol.asyncIterator]() }));
  while (live.length) {
    for (const entry of [...live]) {
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
      yield { adapter: entry.name, ...step.value };
    }
  }
}

// Stores one candidate. Returns "inserted", "known" or the refusal reason.
export async function addCandidate(candidate, source) {
  const norm = await normalizeCandidate(candidate.url, { allowHosted: source !== "search" });
  if (norm.refused) return norm.refused;
  if (await getSiteByDomain(norm.domain)) return "known";
  const site = await upsertSite({
    domain: norm.domain,
    url: norm.url,
    name: candidate.name || null,
    industry: candidate.industryHint || null,
    country: candidate.countryHint || null,
    status: "discovered",
    source,
    sourceRef: candidate.sourceRef || null,
  });
  await recordEvent(site.id, "discovered", { source, sourceRef: candidate.sourceRef || null, from: candidate.url });
  return "inserted";
}

// sources: subset of SOURCES; only: a single adapter name; limit: max new sites
// inserted. Known sites do not count toward it, so galleries are read past the
// entries earlier runs already took, up to `maxReads` candidates in all.
// `until` (ms since epoch) stops it after the candidate in hand once that time
// passes. Returns { found, inserted, skipped }.
export async function discover({ sources = SOURCES, only, limit = 200, maxReads = limit * 10, maxQueries, urls, file, until, log = console.log } = {}) {
  const adapters = adaptersFor(sources, only);
  if (!adapters.length) throw new Error(`no adapter matches ${only ? `--only ${only}` : sources.join(", ")}`);
  const counts = { found: 0, inserted: 0, skipped: 0 };
  const perAdapter = {};
  for await (const candidate of interleave(adapters, { limit: maxReads, maxQueries, urls, file })) {
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
    if (counts.inserted >= limit || counts.found >= maxReads || (until && Date.now() > until)) break;
  }
  for (const [name, t] of Object.entries(perAdapter)) log(`[${name}] found ${t.found}, inserted ${t.inserted}`);
  return counts;
}
