"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/access";
import { db } from "@/lib/db";
import { deleteStoredFile } from "@/lib/files";
import { requireClient } from "@/lib/session";

export type UploadState = { error?: string; ok?: boolean; message?: string };

/**
 * Removing a file the grower added themselves.
 *
 * The adding half lives in direct-actions.ts: a Server Action cannot carry a
 * 200 MB video, so uploads go straight to storage. Two upload paths side by
 * side would be exactly the pair that drifts until one accepts something it
 * should not.
 *
 * Two separate gates, and both matter. The permission says they may delete
 * their own uploads at all; the ownership check says this particular file is
 * one of theirs. Without the second, the permission would let a grower delete
 * the photographs Jinto took as the record of work done on their estate — which
 * is the one thing in the portal that exists precisely so it cannot be
 * rewritten after the fact.
 */
export async function deleteOwnUpload(attachmentId: string) {
  const user = await requireClient();
  await requirePermission("DELETE_OWN_UPLOADS");

  const attachment = await db.attachment.findUnique({
    where: { id: attachmentId },
    select: {
      id: true,
      clientId: true,
      uploadedById: true,
      filename: true,
      storageKey: true,
    },
  });

  // Same 404-shaped answer for "not yours" as everywhere else: whether an
  // attachment id exists is not something to confirm to someone who cannot
  // read it.
  if (!attachment || attachment.clientId !== user.clientId) {
    return { error: "That file no longer exists." };
  }

  if (attachment.uploadedById !== user.id) {
    return {
      error:
        "This one was added by Jinto, so it stays as part of your estate record. Ask him if it should go.",
    };
  }

  await db.attachment.delete({ where: { id: attachment.id } });
  if (attachment.storageKey) await deleteStoredFile(attachment.storageKey);

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "CLIENT_DELETED_OWN_UPLOAD",
      entity: "Attachment",
      entityId: attachment.id,
      meta: JSON.stringify({ filename: attachment.filename }),
    },
  });

  revalidatePath("/dashboard/gallery");
  revalidatePath("/dashboard/documents");
  revalidatePath(`/admin/clients/${user.clientId}`);

  return { ok: true, message: `${attachment.filename} removed.` };
}
