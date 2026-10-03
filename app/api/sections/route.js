import { listArgs, respond } from "../../../lib/api";
import { querySections } from "../../../lib/queries";

export const dynamic = "force-dynamic";

// Takes the section type as `type` or `section`.
export function GET(request) {
  return respond(() => querySections(...listArgs(request)));
}
