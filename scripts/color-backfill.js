// Fills screens.hue_bucket and screens.theme from each screen's dominant color
// and palette (lib/color.js). Usage: npm run color:backfill [-- --all]
// Without --all only screens that have no bucket yet are updated.
import "./env.js";
import { colorTags } from "../lib/color.js";
import { db } from "../lib/db.js";

const all = process.argv.includes("--all");
const rows = db.prepare(`SELECT id, dominant, palette FROM screens ${all ? "" : "WHERE hue_bucket IS NULL"}`).all();
const set = db.prepare("UPDATE screens SET hue_bucket = @hueBucket, theme = @theme WHERE id = @id");
db.transaction(() => {
  for (const r of rows) set.run({ id: r.id, ...colorTags(r.dominant, r.palette) });
})();
console.log(`updated ${rows.length} screens`);
