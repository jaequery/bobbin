// Adds hand-picked sites with source 'manual'.
// Usage: npm run seed -- https://a.com https://b.com   or   npm run seed -- --file seeds.txt
import "./env.js";
import { parseArgs } from "node:util";
import { addCandidate } from "../pipeline/discover/index.js";
import { readSeedFile } from "../pipeline/discover/seeds.js";

const { values, positionals } = parseArgs({ options: { file: { type: "string" } }, allowPositionals: true });
const urls = [...positionals, ...(values.file ? readSeedFile(values.file) : [])];
if (!urls.length) {
  console.error("usage: npm run seed -- <url> [url …]   or   npm run seed -- --file seeds.txt");
  process.exit(1);
}

const counts = { inserted: 0, known: 0, refused: 0 };
for (const url of urls) {
  const result = await addCandidate({ url, sourceRef: values.file ? `file:${values.file}` : "cli" }, "manual");
  if (result === "inserted") counts.inserted++, console.log(`added ${url}`);
  else if (result === "known") counts.known++, console.log(`already known: ${url}`);
  else counts.refused++, console.log(`refused ${url}: ${result}`);
}
console.log(`inserted ${counts.inserted}, already known ${counts.known}, refused ${counts.refused}`);
