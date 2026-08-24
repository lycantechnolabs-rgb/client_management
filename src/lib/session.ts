import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Authorization helpers.
 *
 * The rule this project lives or dies by: a client ID is NEVER read from the
 * request. It comes from the session, and every query is scoped by it.
 * Layout guards protect navigation; server actions must call these too,
 * because a layout does nothing for a direct action invocation.
 */

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

/** Returns the signed-in grower along with their guaranteed clientId. */
export async function requireClient() {
  const user = await requireUser();
  if (user.role !== "CLIENT" || !user.clientId) redirect("/admin");
  return { ...user, clientId: user.clientId };
}

/**
 * Use for anything addressed by ID inside the client portal. Throws unless the
 * record belongs to the signed-in grower.
 */
export function assertOwnership(
  recordClientId: string | null | undefined,
  sessionClientId: string,
) {
  if (!recordClientId || recordClientId !== sessionClientId) {
    throw new Error("Not found");
  }
}
