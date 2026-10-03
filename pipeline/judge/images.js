// Turns a captured WebP under data/shots into a Claude image block: JPEG, at most
// 1568px on the long edge (larger images are downscaled by the API anyway and
// only cost more tokens).
import path from "node:path";
import sharp from "sharp";
import { dataDir } from "../../lib/db.js";

const MAX_EDGE = 1568;

export async function imageBlock(relPath) {
  const data = await sharp(path.join(dataDir, "shots", relPath))
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85 })
    .toBuffer();
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: data.toString("base64") } };
}
