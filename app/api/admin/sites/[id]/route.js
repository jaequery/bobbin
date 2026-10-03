import { adminRoute, jsonBody } from "../../../../../lib/admin";
import { removeSite, siteDetail, updateSite } from "../../../../../lib/admin-data";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async (request, { params }) => siteDetail((await params).id));

export const PATCH = adminRoute(async (request, { params }) => updateSite((await params).id, await jsonBody(request)));

export const DELETE = adminRoute(async (request, { params }) => removeSite((await params).id));
