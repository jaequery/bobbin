import { adminRoute } from "../../../../../../lib/admin";
import { recapture } from "../../../../../../lib/admin-data";

export const dynamic = "force-dynamic";

// Queues a background job; poll GET /api/admin/jobs for its state.
export const POST = adminRoute(async (request, { params }) => recapture((await params).id));
