// Turns a captured WebP shot (lib/shots.js) into a Claude image block: JPEG, at
// most 1568px on the long edge (larger images are downscaled by the API anyway
// and only cost more tokens).
import sharp from "sharp";
import { readShot } from "../../lib/shots.js";

const MAX_EDGE = 1568;

export async function imageBlock(relPath) {
  const shot = await readShot(relPath);
  if (!shot) throw new Error(`missing shot ${relPath}`);
  const data = await sharp(shot)
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85 })
    .toBuffer();
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: data.toString("base64") } };
}
