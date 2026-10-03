import { listArgs, respond } from "../../../lib/api";
import { queryScreens } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export function GET(request) {
  return respond(() => queryScreens(...listArgs(request)));
}
