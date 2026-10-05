// One-off move from the old local SQLite library to Postgres and the shots store.
// Copies every table row into the (migrated, empty) DATABASE_URL database, then
// uploads each referenced image under <data dir>/shots through lib/shots.js
// (Vercel Blob when BLOB_READ_WRITE_TOKEN is set). Re-running skips rows and
// blobs that already exist.
// Usage: npm run import:sqlite -- [path/to/old.db] [--skip-shots]
import "./env.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { dataDir, run, tx, value } from "../lib/db.js";
import { reindexAll } from "../lib/search.js";
import { putShot, shotsDir } from "../lib/shots.js";
import { head } from "@vercel/blob";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--")) || path.join(dataDir, "jethro.db");
const old = new Database(file, { readonly: true, fileMustExist: true });

// Parents before children, so foreign keys hold.
const TABLES = ["sites", "pages", "screens", "sections", "optouts", "events"];
const KEYS = { optouts: "domain" };

for (const table of TABLES) {
  const rows = old.prepare(`SELECT * FROM ${table}`).all();
  if (!rows.length) { console.log(`${table}: 0 rows`); continue; }
  const cols = Object.keys(rows[0]);
  let added = 0;
  await tx(async () => {
    for (let i = 0; i < rows.length; i += 200) {
      const params = {};
      const tuples = rows.slice(i, i + 200).map((r, j) => `(${cols.map((c) => {
        params[`${c}_${j}`] = r[c];
        return `@${c}_${j}`;
      }).join(", ")})`);
      added += await run(`INSERT INTO ${table} (${cols.join(", ")}) VALUES ${tuples.join(", ")} ON CONFLICT (${KEYS[table] || "id"}) DO NOTHING`, params);
    }
  });
  console.log(`${table}: ${added} of ${rows.length} rows added`);
}
// events.id was copied explicitly: move the identity past it.
await run("SELECT setval(pg_get_serial_sequence('events', 'id'), GREATEST((SELECT max(id) FROM events), 1))");
console.log(`search index: ${await reindexAll()} pages`);

if (!args.includes("--skip-shots")) {
  const rels = old.prepare(`
    SELECT full_path AS p FROM screens UNION SELECT lg_path FROM screens UNION SELECT sm_path FROM screens
    UNION SELECT img_path FROM sections UNION SELECT sm_path FROM sections`).all().map((r) => r.p).filter(Boolean);
  const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  let done = 0, uploaded = 0, missing = 0;
  const queue = [...rels];
  await Promise.all(Array.from({ length: 16 }, async () => {
    for (let rel; (rel = queue.shift()); ) {
      if (useBlob && await head(`shots/${rel}`).then(() => true, () => false)) { done++; continue; }
      const data = await readFile(path.join(shotsDir, rel)).catch(() => null);
      if (!data) missing++;
      else if (useBlob) { await putShot(rel, data); uploaded++; }
      if (++done % 500 === 0) console.log(`shots: ${done}/${rels.length}`);
    }
  }));
  console.log(`shots: ${uploaded} uploaded, ${rels.length - uploaded - missing} already there, ${missing} missing on disk${useBlob ? "" : " (no BLOB_READ_WRITE_TOKEN: left on local disk)"}`);
}
console.log(`postgres now has ${await value("SELECT count(*) FROM sites")} sites`);
