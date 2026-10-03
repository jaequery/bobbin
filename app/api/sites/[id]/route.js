import { respond } from "../../../../lib/api";
import { querySite } from "../../../../lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { id } = await params;
  return respond(() => querySite(id));
}
