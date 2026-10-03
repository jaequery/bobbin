// Rebuilds the full-text search index (search_idx) from every page in the database.
// Usage: npm run search:reindex
import "./env.js";
import { reindexAll } from "../lib/search.js";

const t = Date.now();
const n = reindexAll();
console.log(`indexed ${n} pages in ${Date.now() - t}ms`);
