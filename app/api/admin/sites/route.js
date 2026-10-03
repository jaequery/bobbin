import { adminRoute } from "../../../../lib/admin";
import { listTab, tabCounts } from "../../../../lib/admin-data";

export const dynamic = "force-dynamic";

// ?tab=queue|discovered|approved|rejected (default queue), optional ?q=
export const GET = adminRoute((request) => {
  const sp = new URL(request.url).searchParams;
  const tab = sp.get("tab") || "queue";
  return { tab, counts: tabCounts(), items: listTab(tab, { q: sp.get("q") || "" }) };
});
