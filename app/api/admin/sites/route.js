import { adminRoute } from "../../../../lib/admin";
import { listTab, tabCounts } from "../../../../lib/admin-data";

export const dynamic = "force-dynamic";

// ?tab=queue|discovered|approved|rejected (default queue), optional ?q=
export const GET = adminRoute(async (request) => {
  const sp = new URL(request.url).searchParams;
  const tab = sp.get("tab") || "queue";
  const [counts, items] = await Promise.all([tabCounts(), listTab(tab, { q: sp.get("q") || "" })]);
  return { tab, counts, items };
});
