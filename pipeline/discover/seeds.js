// Manual seeds: URLs given directly, or read from a file with one URL per line
// (blank lines and # comments ignored).
import { readFileSync } from "node:fs";

export const name = "manual";

export function readSeedFile(file) {
  return parseSeedText(readFileSync(file, "utf8"));
}

export function parseSeedText(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean);
}

export async function* listing({ urls = [], file, limit = Infinity } = {}) {
  const all = [...urls, ...(file ? readSeedFile(file) : [])];
  for (const url of all.slice(0, limit)) yield { url, sourceRef: file ? `file:${file}` : "cli" };
}
