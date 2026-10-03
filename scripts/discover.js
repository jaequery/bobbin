// Finds candidate sites and inserts them with status 'discovered'.
// Usage: npm run discover -- [--source galleries|search|seeds|all] [--limit 200]
//        [--only <adapter>] [--max-queries 30] [--file seeds.txt]
import "./env.js";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { discover, SOURCES } from "../pipeline/discover/index.js";

const { values } = parseArgs({
  options: {
    source: { type: "string", default: "all" },
    limit: { type: "string", default: "200" },
    only: { type: "string" },
    "max-queries": { type: "string", default: "30" },
    file: { type: "string" },
  },
});

const sources = values.source === "all" ? SOURCES : values.source.split(",");
const unknown = sources.filter((s) => !SOURCES.includes(s));
if (unknown.length) {
  console.error(`unknown --source ${unknown.join(", ")} (use ${SOURCES.join("|")}|all)`);
  process.exit(1);
}
const file = values.file ?? ["seeds.txt", "seeds.example.txt"].find((f) => existsSync(f));

try {
  const result = await discover({
    sources,
    only: values.only,
    limit: Number(values.limit) || 200,
    maxQueries: Number(values["max-queries"]) || 30,
    file: sources.includes("seeds") ? file : undefined,
  });
  console.log(`found ${result.found}, inserted ${result.inserted}, skipped ${result.skipped}`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
