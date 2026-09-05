import { clientCan } from "@/lib/access";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * May this caller read this attachment, and what is it?
 *
 * Extracted because there are now two doors onto the same bytes — the file
 * itself and its thumbnail — and two copies of an access check is the shape
 * that drifts. One of them gets a fix, the other does not, and the one that
 * did not is the one still serving other people's photographs.
 *
 * The rule is unchanged: the client ID comes from the session, never the
 * request. The URL names an attachment; whether it may be read is decided here
 * against the database, so guessing an id gains nothing.
 */

export type AttachmentAccess =
  | { ok: true; attachment: AttachmentRow }
  | { ok: false; status: 403 | 404; reason: string };

type AttachmentRow = {
  clientId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  kind: string;
};

export async function authorizeAttachment(id: string): Promise<AttachmentAccess> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 404, reason: "no session" };

  const attachment = await db.attachment.findUnique({
    where: { id },
    select: {
      clientId: true,
      storageKey: true,
      filename: true,
      mimeType: true,
      kind: true,
    },
  });
  if (!attachment?.storageKey) {
    return { ok: false, status: 404, reason: "no such attachment" };
  }

  const allowed =
    user.role === "ADMIN" ||
    (user.role === "CLIENT" && user.clientId === attachment.clientId);

  // The same 404 as a row that does not exist: a 403 here would confirm the
  // attachment is real to someone who may not know it.
  if (!allowed) return { ok: false, status: 404, reason: "not yours" };

  // Ownership says the file is theirs; the permission says whether they may
  // still take it away (Doc 06 s.4).
  //
  // 403 rather than 404, deliberately: a grower whose download rights were
  // withdrawn already knows their own photographs exist, so pretending
  // otherwise would only confuse them.
  if (
    user.role === "CLIENT" &&
    !(await clientCan(user.clientId!, "DOWNLOAD_OWN_FILES"))
  ) {
    return {
      ok: false,
      status: 403,
      reason: "Downloads are switched off for this account.",
    };
  }

  return {
    ok: true,
    attachment: {
      ...attachment,
      // Narrowed above — the guard returns 404 on a null key — but the select
      // types it as nullable, and asserting here keeps every caller from
      // re-checking something already decided.
      storageKey: attachment.storageKey,
      mimeType: attachment.mimeType || "application/octet-stream",
    },
  };
}
