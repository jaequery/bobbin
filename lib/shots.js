// Captured WebP images ("shots"), keyed by a path relative to the shots root:
// "<siteId>/home-desktop-lg.webp". Server only.
//
// With BLOB_READ_WRITE_TOKEN set they live in the project's private Vercel Blob
// store under "shots/"; without it (local work with no Blob access) they live
// under JETHRO_DATA_DIR/shots. Reads try the local copy first either way.
import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { del, get, list, put } from "@vercel/blob";
import { dataDir } from "./db.js";

// turbopackIgnore: these are runtime paths; without it Next traces data/ into the build.
export const shotsDir = path.join(/*turbopackIgnore: true*/ dataDir, "shots");
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const blobPath = (rel) => `shots/${rel}`;
const localPath = (rel) => path.join(/*turbopackIgnore: true*/ shotsDir, rel);

export async function putShot(rel, data) {
  if (useBlob()) {
    await put(blobPath(rel), data, {
      access: "private", contentType: "image/webp", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 31536000,
    });
    return;
  }
  await mkdir(path.dirname(localPath(rel)), { recursive: true });
  await writeFile(localPath(rel), data);
}

// The image as a Buffer, or null when it does not exist.
export async function readShot(rel) {
  try {
    return await readFile(localPath(rel));
  } catch {}
  if (!useBlob()) return null;
  const r = await get(blobPath(rel), { access: "private" });
  return r?.statusCode === 200 ? Buffer.from(await new Response(r.stream).arrayBuffer()) : null;
}

// { stream, size } for serving, or null when it does not exist.
export async function openShot(rel) {
  try {
    const info = await stat(localPath(rel));
    if (info.isFile()) return { stream: Readable.toWeb(createReadStream(localPath(rel))), size: info.size };
  } catch {}
  if (!useBlob()) return null;
  const r = await get(blobPath(rel), { access: "private" });
  return r?.statusCode === 200 ? { stream: r.stream, size: r.blob.size } : null;
}

export async function removeShots(rels) {
  if (!rels.length) return;
  await Promise.all(rels.map((rel) => rm(localPath(rel), { force: true })));
  if (useBlob()) for (let i = 0; i < rels.length; i += 500) await del(rels.slice(i, i + 500).map(blobPath));
}

// Removes every shot of a site.
export async function removeSiteShots(siteId) {
  await rm(path.join(/*turbopackIgnore: true*/ shotsDir, siteId), { recursive: true, force: true });
  if (!useBlob()) return;
  let cursor;
  do {
    const page = await list({ prefix: blobPath(`${siteId}/`), cursor, limit: 1000 });
    if (page.blobs.length) await del(page.blobs.map((b) => b.url));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}
