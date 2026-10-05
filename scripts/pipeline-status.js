// Prints how many sites are in each status, what the pipeline would pick up
// next, and the last 10 errors.
// Usage: npm run pipeline:status
import "./env.js";
import { lastEvent, queueCounts, recentErrors, statusCounts } from "../lib/db.js";
import { SITE_STATUS } from "../lib/taxonomy.js";

const counts = await statusCounts();
const extra = Object.keys(counts).filter((s) => !SITE_STATUS.includes(s));
const w = Math.max(...[...SITE_STATUS, ...extra].map((s) => s.length));
console.log("sites by status");
for (const s of [...SITE_STATUS, ...extra]) console.log(`  ${s.padEnd(w)}  ${counts[s] ?? 0}`);
console.log(`  ${"total".padEnd(w)}  ${Object.values(counts).reduce((a, b) => a + b, 0)}`);

const q = await queueCounts();
console.log(`\nwaiting: ${q.capture} to capture, ${q.judge} to judge, ${q.finish} approved to finish`);

const run = await lastEvent("pipeline_finished");
if (run) {
  const t = JSON.parse(run.detail);
  console.log(`last run ${t.run} finished ${run.at}: ${t.claimed} claimed, ${t.approved} approved, ${t.rejected} rejected, ${t.failed} failed, ${t.aiCalls} AI calls (${t.stopped})`);
}

const errors = await recentErrors(10);
console.log(`\nlast ${errors.length} errors`);
for (const e of errors) {
  const d = e.detail ? JSON.parse(e.detail) : {};
  const what = [d.code, d.path, d.message].filter(Boolean).join(" ");
  console.log(`  ${e.at.slice(0, 19).replace("T", " ")}  ${e.kind.padEnd(14)}  ${e.domain ?? "-"}  ${what.slice(0, 140)}`);
}
