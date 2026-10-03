import { adminRoute } from "../../../../lib/admin";
import { listJobs } from "../../../../lib/jobs";

export const dynamic = "force-dynamic";

export const GET = adminRoute(() => ({ items: listJobs() }));
