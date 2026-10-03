import { adminRoute, jsonBody } from "../../../../lib/admin";
import { decideRemoval, removalRequests } from "../../../../lib/admin-data";

export const dynamic = "force-dynamic";

export const GET = adminRoute(() => ({ items: removalRequests() }));

// { domain, status: "approved" | "dismissed" }
export const PATCH = adminRoute(async (request) => {
  const body = await jsonBody(request);
  return decideRemoval(String(body.domain || ""), body.status);
});
