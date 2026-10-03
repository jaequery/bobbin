// Discovers, captures, judges and tags sites in one resumable run.
// Usage: npm run pipeline -- [--discover] [--sources galleries,search] [--limit 25]
//        [--concurrency 3] [--max-judge 100] [--recapture-older-than 90d]
//        [--retry-failed] [--prune-rejected] [--watch 6h] [--dry-run]
// Ctrl-C once stops claiming and lets in-flight sites finish; twice quits now.
import "./env.js";
import { parseArgs } from "node:util";
import { setOwnSignals } from "../pipeline/browser.js";
import { closeBrowser } from "../pipeline/capture.js";
import { SOURCES } from "../pipeline/discover/index.js";
import { DEFAULTS, parseDuration, runPipeline } from "../pipeline/run.js";

const USAGE = "usage: npm run pipeline -- [--discover] [--sources galleries,search] [--limit N] [--concurrency C] [--max-judge N] [--recapture-older-than 90d] [--retry-failed] [--prune-rejected] [--watch 6h] [--dry-run]";

let values;
try {
  ({ values } = parseArgs({
    options: {
      discover: { type: "boolean", default: false },
      sources: { type: "string", default: DEFAULTS.sources.join(",") },
      "discover-limit": { type: "string", default: String(DEFAULTS.discoverLimit) },
      limit: { type: "string", default: String(DEFAULTS.limit) },
      concurrency: { type: "string", default: String(DEFAULTS.concurrency) },
      "max-judge": { type: "string", default: String(DEFAULTS.maxJudge) },
      "recapture-older-than": { type: "string" },
      "retry-failed": { type: "boolean", default: false },
      "prune-rejected": { type: "boolean", default: false },
      watch: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  }));
} catch (err) {
  console.error(`${err.message}\n${USAGE}`);
  process.exit(2);
}

const fail = (msg) => {
  console.error(`${msg}\n${USAGE}`);
  process.exit(2);
};
const count = (flag, min) => {
  const n = Number(values[flag]);
  if (!Number.isInteger(n) || n < min) fail(`--${flag} must be a whole number >= ${min}`);
  return n;
};

const sources = values.sources.split(",").map((s) => s.trim()).filter(Boolean);
const unknown = sources.filter((s) => !SOURCES.includes(s));
if (unknown.length) fail(`unknown --sources ${unknown.join(", ")} (use ${SOURCES.join(", ")})`);

const recapture = values["recapture-older-than"];
const watch = values.watch;
const options = {
  discover: values.discover,
  sources,
  discoverLimit: count("discover-limit", 1),
  limit: count("limit", 1),
  concurrency: count("concurrency", 1),
  maxJudge: count("max-judge", 0),
  recaptureOlderThan: recapture ? parseDuration(recapture) ?? fail(`bad --recapture-older-than ${recapture} (e.g. 90d)`) : null,
  retryFailed: values["retry-failed"],
  pruneRejected: values["prune-rejected"],
  dryRun: values["dry-run"],
};
const interval = watch ? parseDuration(watch) ?? fail(`bad --watch ${watch} (e.g. 6h)`) : null;

// The pipeline closes the browser itself, after in-flight sites finish.
setOwnSignals(true);
const controller = new AbortController();
let signals = 0;
const onSignal = async (name) => {
  if (++signals === 1) {
    console.log(`\n${name}: finishing in-flight sites, then stopping (again to quit now)`);
    controller.abort();
    return;
  }
  console.log(`\n${name}: quitting now; claimed sites are released by the next run after 30 minutes`);
  await closeBrowser();
  process.exit(130);
};
process.on("SIGINT", () => onSignal("SIGINT"));
process.on("SIGTERM", () => onSignal("SIGTERM"));

let code = 0;
try {
  do {
    await runPipeline(options, { signal: controller.signal });
    if (!interval || controller.signal.aborted || options.dryRun) break;
    console.log(`next run at ${new Date(Date.now() + interval).toLocaleString()} (Ctrl-C to stop)`);
    await new Promise((resolve) => {
      const t = setTimeout(resolve, interval);
      controller.signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
    });
  } while (!controller.signal.aborted);
} catch (err) {
  console.error(`pipeline failed: ${err.stack || err.message}`);
  code = 1;
} finally {
  await closeBrowser();
}
process.exit(code);
