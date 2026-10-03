import { listArgs, respond } from "../../../lib/api";
import { querySites } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export function GET(request) {
  return respond(() => querySites(...listArgs(request)));
}
