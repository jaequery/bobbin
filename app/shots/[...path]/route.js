import { isAdminRequest } from "../../../lib/admin";
import { isPublicSite } from "../../../lib/queries";
import { openShot } from "../../../lib/shots";

export const dynamic = "force-dynamic";

const notFound = () => new Response("Not found", { status: 404 });

// Streams a captured WebP (lib/shots.js: private Blob, or JETHRO_DATA_DIR/shots
// locally). The first segment is the site id, so images of sites that are not
// public (unjudged, rejected, opted out) are not served either, except to the
// local admin.
export async function GET(request, { params }) {
  const parts = (await params).path || [];
  if (!parts.length || parts.some((p) => !p || p === "." || p === ".." || /[\\/\0]/.test(p))) return notFound();
  if (!parts[parts.length - 1].endsWith(".webp")) return notFound();
  const isPublic = await isPublicSite(parts[0]);
  if (!isPublic && !isAdminRequest(request.headers)) return notFound();

  const shot = await openShot(parts.join("/"));
  if (!shot) return notFound();
  return new Response(shot.stream, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(shot.size),
      "Cache-Control": isPublic ? "public, max-age=31536000, immutable" : "private, no-store",
    },
  });
}
