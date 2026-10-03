import { respond } from "../../../lib/api";
import { querySuggest } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export function GET(request) {
  return respond(() => querySuggest(new URL(request.url).searchParams.get("q")));
}
