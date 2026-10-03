// Sorts a captured color into one of the COLOR_BUCKETS and a light or dark
// theme. Plain functions, no database: the capture engine calls colorTags for
// each new screen and scripts/color-backfill.js for existing rows.

// "#1A4FD0" -> [r, g, b], or null for anything that is not a 6-digit hex.
export function fromHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
}

// [h 0–360, s 0–1, l 0–1]
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

const isNeutral = ([, s, l]) => s < 0.12 || l < 0.08 || l > 0.95;

// The bucket of one color: near-neutral colors go to black, white or gray by
// lightness; the rest by hue, with dark warm hues counted as brown.
export function bucketOf(hsl) {
  const [h, s, l] = hsl;
  if (isNeutral(hsl)) return l < 0.2 ? "black" : l > 0.85 ? "white" : "gray";
  if (h >= 10 && h < 50 && l < 0.4 && s < 0.85) return "brown";
  if (h < 15 || h >= 345) return "red";
  if (h < 40) return "orange";
  if (h < 65) return "yellow";
  if (h < 160) return "green";
  if (h < 195) return "teal";
  if (h < 255) return "blue";
  if (h < 290) return "purple";
  return "pink";
}

// { hueBucket, theme } for a screen from its dominant color and palette (hex
// strings, most common first). The theme follows the dominant (background)
// color. Most sites sit on a white or black background, so the bucket is the
// dominant color when it has a hue, else the first palette color that does,
// else the neutral the dominant color is. Unreadable input gives nulls.
export function colorTags(dominant, palette = []) {
  const rgb = fromHex(dominant);
  if (!rgb) return { hueBucket: null, theme: null };
  const base = rgbToHsl(...rgb);
  const theme = base[2] < 0.5 ? "dark" : "light";
  if (!isNeutral(base)) return { hueBucket: bucketOf(base), theme };
  const list = typeof palette === "string" ? safeParse(palette) : palette;
  for (const c of Array.isArray(list) ? list : []) {
    const p = fromHex(c);
    if (!p) continue;
    const hsl = rgbToHsl(...p);
    if (hsl[1] >= 0.25 && hsl[2] >= 0.15 && hsl[2] <= 0.85) return { hueBucket: bucketOf(hsl), theme };
  }
  return { hueBucket: bucketOf(base), theme };
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}
