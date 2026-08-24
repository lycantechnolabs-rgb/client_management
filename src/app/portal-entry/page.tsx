import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";

/** Post-login landing: sends each role to the right home. */
export default async function PortalEntry() {
  const user = await requireUser();
  redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
}
