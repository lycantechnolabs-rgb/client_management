import { buildGrowerExport } from "@/lib/dpdp-export";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * The s.11 right of access, as a file the grower can keep.
 *
 * The client ID comes from the session and nowhere else. This route takes no
 * parameters at all — there is deliberately no `?clientId=` to tamper with,
 * because an access endpoint that could be aimed at another account would hand
 * over in one request precisely what the whole portal is built to keep apart.
 *
 * Admins get a 404 rather than a helpful error: this is a Data Principal's
 * own-data route, and Jinto reaching a grower's export belongs in the admin
 * request queue where it is logged against a verified request, not here.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CLIENT" || !user.clientId) {
    return new Response("Not found", { status: 404 });
  }

  const data = await buildGrowerExport(user.clientId);

  // Exercising a right is itself an event worth being able to evidence later.
  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "DPDP_SELF_EXPORT",
      entity: "Client",
      entityId: user.clientId,
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="aela-my-data-${stamp}.json"`,
      // This is the most sensitive response the app produces. It must not sit
      // in any cache, shared or otherwise.
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
    },
  });
}
