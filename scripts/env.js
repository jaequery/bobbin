// Loads .env.local, then .env, into process.env (existing variables win).
// Import it before lib/db.js. `vercel env pull` writes DATABASE_URL and
// BLOB_READ_WRITE_TOKEN to .env.local.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {}
}
