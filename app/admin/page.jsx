import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isAdminRequest } from "../../lib/admin";
import Admin from "./Admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Jethro admin",
  robots: { index: false, follow: false },
};

// Local curation. Exists only with JETHRO_ADMIN=1 and a loopback request; see lib/admin.js.
export default async function AdminPage() {
  if (!isAdminRequest(await headers())) notFound();
  return <Admin />;
}
