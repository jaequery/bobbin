import { respond } from "../../../../lib/api";
import { libraryMeta } from "../../../../lib/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return respond(() => libraryMeta());
}
