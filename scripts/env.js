// Loads .env into process.env (existing variables win). Import it before lib/db.js.
try {
  process.loadEnvFile(".env");
} catch {}
