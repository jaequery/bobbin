// Judges captured sites with Claude vision and tags the approved ones.
// Usage: npm run judge -- <siteId|domain> [--dry-run]
//        npm run judge -- --all-captured [--limit N]
//        npm run judge -- --retag <siteId|domain>
import "./env.js";
import { listSites } from "../lib/db.js";
import { judgeModel, judgeSite, minQuality, tagSite } from "../pipeline/judge/index.js";

const USAGE = "usage: npm run judge -- <siteId|domain> [--dry-run] | --all-captured [--limit N] | --retag <siteId|domain>";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};
const limitArg = valueOf("--limit");
const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--limit");
const dryRun = flags.has("--dry-run");

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set (add it to .env); the judge is disabled.");
  process.exit(1);
}

let targets;
let retag = false;
if (flags.has("--retag")) {
  retag = true;
  targets = positional.slice(0, 1);
} else if (flags.has("--all-captured")) {
  const limit = limitArg ? Number(limitArg) : Infinity;
  if (!(limit > 0)) {
    console.error(USAGE);
    process.exit(2);
  }
  targets = [];
  let cursor;
  do {
    const page = listSites({ status: "captured", limit: 200, cursor });
    targets.push(...page.items.map((s) => s.id));
    cursor = page.next;
  } while (cursor && targets.length < limit);
  targets = targets.slice(0, limit);
} else {
  targets = positional;
}
if (!targets.length) {
  console.error(flags.has("--all-captured") ? "no captured sites to judge" : USAGE);
  process.exit(flags.has("--all-captured") ? 0 : 2);
}

let spent = 0;
let tokens = 0;
const money = (n) => `$${n.toFixed(4)}`;
const tally = (r) => {
  spent += r.cost;
  tokens += Object.values(r.usage).reduce((a, b) => a + b, 0);
  return `${tokens} tokens, ${money(spent)} so far`;
};

if (!dryRun) console.error(`model ${judgeModel()}, approve at quality >= ${minQuality()}`);
let code = 0;
for (const target of targets) {
  try {
    if (retag) {
      const r = await tagSite(target, { dryRun });
      console.error(`tagged ${target}: ${r.pages.length} pages (${tally(r)})`);
      if (dryRun) console.log(JSON.stringify(r.pages, null, 2));
      continue;
    }
    const r = await judgeSite(target, { dryRun });
    if (dryRun) {
      console.log(JSON.stringify({ domain: r.site.domain, status: r.status, ...r.judgement }, null, 2));
      console.error(`(dry run, nothing written; ${tally(r)})`);
      continue;
    }
    const why = r.error ?? (r.judgement.capture_ok ? r.judgement.verdict_reasons[0] : `bad capture: ${r.judgement.capture_problem}`);
    console.log(`${r.status.padEnd(8)} ${String(r.judgement?.capture_ok ? r.judgement.quality : "-").padStart(2)}  ${r.site.domain}  ${why ?? ""}`);
    if (r.status === "approved") {
      const t = await tagSite(r.site);
      console.log(`         tagged ${t.pages.length} pages`);
      tally(t);
    }
    console.error(`  (${tally(r)})`);
  } catch (err) {
    console.error(`error    ${target}: ${err.message}`);
    code = 1;
  }
}
console.error(`total: ${tokens} tokens, about ${money(spent)}`);
process.exit(code);
