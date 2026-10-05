// Fills screens.hue_bucket and screens.theme from each screen's dominant color
// and palette (lib/color.js). Usage: npm run color:backfill [-- --all]
// Without --all only screens that have no bucket yet are updated.
import "./env.js";
import { colorTags } from "../lib/color.js";
import { all, run, tx } from "../lib/db.js";

const every = process.argv.includes("--all");
const rows = await all(`SELECT id, dominant, palette FROM screens ${every ? "" : "WHERE hue_bucket IS NULL"}`);
await tx(async () => {
  for (const r of rows) await run("UPDATE screens SET hue_bucket = @hueBucket, theme = @theme WHERE id = @id", { id: r.id, ...colorTags(r.dominant, r.palette) });
});
console.log(`updated ${rows.length} screens`);
