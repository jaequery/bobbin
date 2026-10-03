import { adminRoute, jsonBody } from "../../../../lib/admin";
import { addSeeds } from "../../../../lib/admin-data";

export const dynamic = "force-dynamic";

// { urls: "one URL per line, # comments allowed" }
export const POST = adminRoute(async (request) => addSeeds((await jsonBody(request)).urls));
