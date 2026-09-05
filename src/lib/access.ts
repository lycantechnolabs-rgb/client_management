import { cache } from "react";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { resolvePermission, type PermissionKey } from "@/lib/permissions";

/**
 * Permission checks.
 *
 * Deliberately read from the database rather than from the session token.
 *
 * The portal already re-reads the user on every request so that deactivating a
 * grower signs them out immediately rather than whenever their token happens to
 * expire. Permissions have to behave the same way: when Jinto takes away a
 * grower's upload rights it is usually because something has gone wrong, and a
 * revocation that waits for a token to lapse is not a revocation. Putting them
 * in the JWT would have been cheaper and wrong.
 *
 * React's cache() collapses the reads to one per request, so a page checking
 * five permissions still makes a single query.
 */

const loadOverrides = cache(
  async (clientId: string): Promise<Record<string, boolean>> => {
    const rows = await db.clientPermission.findMany({
      where: { clientId },
      select: { key: true, allowed: true },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.allowed]));
  },
);

/** Every stored decision for one grower. Used by the admin screens. */
export async function getClientOverrides(clientId: string) {
  return loadOverrides(clientId);
}

/**
 * Can the signed-in user do this?
 *
 * Answers false for a signed-out caller rather than throwing, so it is safe to
 * use for hiding UI. Anything that *acts* must use requirePermission instead —
 * hiding a button is not access control.
 */
export async function can(key: PermissionKey): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  if (user.role === "ADMIN") return resolvePermission("ADMIN", key, {});
  if (!user.clientId) return false;

  const overrides = await loadOverrides(user.clientId);
  return resolvePermission(user.role, key, overrides);
}

/** True only if every one of these is allowed. */
export async function canAll(...keys: PermissionKey[]): Promise<boolean> {
  for (const key of keys) {
    if (!(await can(key))) return false;
  }
  return true;
}

/**
 * The server-side gate. Throws unless the caller holds the permission.
 *
 * Throwing rather than redirecting because this guards server actions and route
 * handlers, where a redirect would be swallowed or would turn a refusal into a
 * confusing navigation. Callers that need a friendly message should check with
 * can() first and use this as the backstop.
 */
export async function requirePermission(key: PermissionKey): Promise<void> {
  if (!(await can(key))) {
    throw new Error("Not permitted");
  }
}

/**
 * Whether a specific grower holds a permission, asked by an admin.
 *
 * Separate from can() on purpose: can() answers about the *caller*, and mixing
 * the two is how an admin's own rights end up standing in for a grower's. This
 * one never consults the session.
 */
export async function clientCan(
  clientId: string,
  key: PermissionKey,
): Promise<boolean> {
  const overrides = await loadOverrides(clientId);
  return resolvePermission("CLIENT", key, overrides);
}
