import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { dataDir } from "../../../lib/db";
import { isPublicSite } from "../../../lib/queries";

export const dynamic = "force-dynamic";

const shotsDir = path.join(dataDir, "shots");
const notFound = () => new Response("Not found", { status: 404 });

// Streams a captured WebP from BOBBIN_DATA_DIR/shots. The first segment is the
// site id, so images of sites that are not public (unjudged, rejected, opted
// out) are not served either.
export async function GET(request, { params }) {
  const parts = (await params).path || [];
  if (!parts.length || parts.some((p) => !p || p === "." || p === ".." || /[\\/\0]/.test(p))) return notFound();
  const file = path.resolve(shotsDir, ...parts);
  if (!file.startsWith(shotsDir + path.sep) || !file.endsWith(".webp")) return notFound();
  if (!isPublicSite(parts[0])) return notFound();

  let info;
  try {
    info = await stat(file);
  } catch {
    return notFound();
  }
  if (!info.isFile()) return notFound();
  return new Response(Readable.toWeb(createReadStream(file)), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(info.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
