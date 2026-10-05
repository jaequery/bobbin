// Applies unapplied db/migrations/*.sql files in filename order. Safe to re-run.
// Usage: npm run db:migrate   (uses DATABASE_URL_UNPOOLED when set, else DATABASE_URL)
import "./env.js";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Migrations take the direct connection: DDL through Neon's pooler is fragile.
if (process.env.DATABASE_URL_UNPOOLED) process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
const { all, query, tx } = await import("../lib/db.js");

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

await query("CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
const applied = new Set((await all("SELECT name FROM migrations")).map((r) => r.name));
const pending = readdirSync(dir).filter((f) => f.endsWith(".sql") && !applied.has(f)).sort();

for (const name of pending) {
  const sql = readFileSync(path.join(dir, name), "utf8");
  try {
    await tx(async () => {
      await query(sql, []); // raw: no @name rewriting
      await query("INSERT INTO migrations (name, applied_at) VALUES (@name, @at)", { name, at: new Date().toISOString() });
    });
    console.log(`applied ${name}`);
  } catch (err) {
    console.error(`migration ${name} failed, rolled back: ${err.message}`);
    process.exit(1);
  }
}

console.log(pending.length ? "database is up to date" : "database already up to date");
