"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { can } from "@/lib/access";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/session";
import { storage } from "@/lib/storage";
import {
  DOCUMENT_CATEGORIES,
} from "@/lib/constants";
import { uploadCapacity } from "@/lib/upload-capacity";
import {
  TICKET_TTL_MINUTES,
  formatBytes,
  kindOf,
  type UploadKind,
} from "@/lib/upload-limits";

export type TicketState =
  | { error: string }
  | {
      token: string;
      url: string;
      headers: Record<string, string>;
      maxBytes: number;
    };

const KIND_PERMISSION: Record<UploadKind, string> = {
  IMAGE: "UPLOAD_PHOTOS",
  VIDEO: "UPLOAD_VIDEOS",
  DOCUMENT: "UPLOAD_DOCUMENTS",
};

const KIND_LABEL: Record<UploadKind, string> = {
  IMAGE: "photos",
  VIDEO: "videos",
  DOCUMENT: "documents",
};

/**
 * Step one: may this person upload this, and where should it go?
 *
 * Everything the server will later rely on is decided here, while it still has
 * the session in hand — who, which estate, what kind, how big, and under what
 * storage key. The browser is told only the address and the token.
 *
 * The declared content type is not trusted as fact, it is *pinned*: whatever is
 * claimed here is what the completion step requires the stored object to be. A
 * client that lies about its type gets an attachment row describing the lie and
 * a file that will not open — it does not get to smuggle one kind past the
 * permission check for another.
 */
export async function requestUploadTicket(
  filename: string,
  mimeType: string,
  declaredBytes: number,
): Promise<TicketState> {
  const user = await requireClient();

  const kind = kindOf(mimeType);
  if (!kind) return { error: `${filename} is not an accepted file type.` };

  if (!(await can(KIND_PERMISSION[kind]))) {
    return {
      error: `Uploading ${KIND_LABEL[kind]} is switched off for your account.`,
    };
  }

  const capacity = uploadCapacity();

  // Nowhere to store it. The form is not offered in this state, so reaching
  // here means a stale page or a direct call — either way, accepting the file
  // and losing it silently would be worse than saying so.
  if (!capacity.available) {
    return {
      error: "Uploads are unavailable at the moment. Please tell Jinto.",
    };
  }

  // The effective ceiling, not the intended one. Where storage is not
  // configured these differ, and quoting the number this deployment cannot
  // actually carry would refuse the file with a figure that contradicts the
  // refusal.
  const maxBytes = capacity.limits[kind];
  if (declaredBytes > maxBytes) {
    return {
      error: `${filename} is larger than the ${formatBytes(maxBytes)} limit for ${KIND_LABEL[kind]}.`,
    };
  }

  const driver = storage();
  const storageKey = driver.keyFor(filename, mimeType);
  const token = randomBytes(24).toString("base64url");

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + TICKET_TTL_MINUTES);

  await db.uploadTicket.create({
    data: {
      token,
      userId: user.id,
      clientId: user.clientId,
      kind,
      mimeType,
      filename: filename.slice(0, 200),
      maxBytes,
      storageKey,
      expiresAt,
    },
  });

  const target = driver.target(token, storageKey, mimeType);

  return {
    token,
    url: target.url,
    headers: target.headers,
    maxBytes,
  };
}

export type CompleteState = { error?: string; ok?: boolean; message?: string };

/**
 * Step three: the browser says it finished. Check whether it did.
 *
 * Nothing here believes the client. The size comes from storage, not from the
 * request; the ticket supplies the owner, the kind and the key. The only thing
 * taken from the caller is the caption and category, which are theirs to write
 * anyway.
 *
 * A ticket is single-use — completing one moves it out of ISSUED, so replaying
 * the same token cannot mint a second attachment pointing at the same object.
 */
export async function completeUpload(
  token: string,
  caption: string,
  category: string,
): Promise<CompleteState> {
  const user = await requireClient();

  const ticket = await db.uploadTicket.findUnique({ where: { token } });

  // Belongs to someone else, or does not exist: the same answer either way.
  if (!ticket || ticket.userId !== user.id || ticket.clientId !== user.clientId) {
    return { error: "That upload is not recognised." };
  }
  if (ticket.status !== "ISSUED") {
    return { error: "That upload has already been finished." };
  }
  if (ticket.expiresAt < new Date()) {
    await db.uploadTicket.update({
      where: { id: ticket.id },
      data: { status: "EXPIRED" },
    });
    return { error: "That upload took too long. Please try again." };
  }

  const driver = storage();
  const bytes = await driver.sizeOf(ticket.storageKey);

  if (bytes === null || bytes === 0) {
    return { error: "The file did not arrive. Please try again." };
  }
  if (bytes > ticket.maxBytes) {
    // Bigger than the ticket allowed: the browser sent more than it declared.
    await driver.remove(ticket.storageKey);
    await db.uploadTicket.update({
      where: { id: ticket.id },
      data: { status: "EXPIRED" },
    });
    return { error: "That file is larger than the limit. Nothing was saved." };
  }

  const validCategory = DOCUMENT_CATEGORIES.some((c) => c.key === category);

  await db.$transaction([
    db.attachment.create({
      data: {
        clientId: ticket.clientId,
        uploadedById: user.id,
        kind: ticket.kind,
        url: "",
        storageKey: ticket.storageKey,
        filename: ticket.filename,
        mimeType: ticket.mimeType,
        sizeBytes: bytes,
        caption: caption.trim().slice(0, 300) || null,
        category:
          ticket.kind === "DOCUMENT"
            ? validCategory
              ? category
              : "OTHER"
            : null,
      },
    }),
    db.uploadTicket.update({
      where: { id: ticket.id },
      data: { status: "COMPLETED", bytes, completedAt: new Date() },
    }),
  ]);

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "CLIENT_UPLOAD",
      entity: "Attachment",
      meta: JSON.stringify({
        kind: ticket.kind,
        bytes,
        via: "direct",
      }),
    },
  });

  revalidatePath("/dashboard/gallery");
  revalidatePath("/dashboard/documents");
  revalidatePath(`/admin/clients/${ticket.clientId}`);

  return { ok: true, message: "Added." };
}
