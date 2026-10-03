// Applies unapplied db/migrations/*.sql files in filename order. Safe to re-run.
// Usage: npm run db:migrate   (BOBBIN_DATA_DIR overrides ./data)
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, dbPath } from "../lib/db.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

db.exec("CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
const applied = new Set(db.prepare("SELECT name FROM migrations").pluck().all());
const pending = readdirSync(dir).filter((f) => f.endsWith(".sql") && !applied.has(f)).sort();

for (const name of pending) {
  const sql = readFileSync(path.join(dir, name), "utf8");
  try {
    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO migrations (name, applied_at) VALUES (?, ?)").run(name, new Date().toISOString());
    })();
    console.log(`applied ${name}`);
  } catch (err) {
    console.error(`migration ${name} failed, rolled back: ${err.message}`);
    process.exit(1);
  }
}

console.log(pending.length ? `${dbPath} is up to date` : `${dbPath} already up to date`);
