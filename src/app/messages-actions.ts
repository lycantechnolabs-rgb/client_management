"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  NOTIFICATION_KINDS,
  adminRecipient,
  queueNotification,
} from "@/lib/notify";
import { getCurrentUser } from "@/lib/session";

export type MessageState = { error?: string; ok?: boolean };

const schema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(4000, "That is longer than a message should be — call instead"),
});

/**
 * Resolve which conversation the caller is allowed to write to.
 *
 * A grower's thread is their own, taken from the session; there is no client ID
 * in their request to tamper with. Jinto names the grower, and that is the only
 * path where the ID comes from the request — so it is checked against the
 * database here rather than trusted.
 */
async function resolveThread(requestedClientId?: string | null) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." as const };

  if (user.role === "CLIENT") {
    if (!user.clientId) return { error: "No estate on this account." as const };
    // Deliberately ignores anything the form supplied.
    return { user, clientId: user.clientId };
  }

  if (user.role === "ADMIN") {
    if (!requestedClientId) return { error: "Which grower?" as const };
    const client = await db.client.findUnique({
      where: { id: requestedClientId },
      select: { id: true },
    });
    if (!client) return { error: "That client no longer exists." as const };
    return { user, clientId: client.id };
  }

  return { error: "Not permitted." as const };
}

/**
 * The recipient is whoever did not write it: a grower writes to Jinto, Jinto
 * writes to that grower. Excerpted rather than quoted in full — the point is to
 * get them to open the portal, and the whole message will be waiting there.
 */
async function notifyOtherParty(
  senderRole: string,
  clientId: string,
  senderName: string,
  body: string,
) {
  const excerpt = body.length > 140 ? `${body.slice(0, 140)}…` : body;

  if (senderRole === "CLIENT") {
    const admin = await adminRecipient();
    if (!admin) return;
    await queueNotification({
      kind: NOTIFICATION_KINDS.NEW_MESSAGE,
      toName: admin.name ?? "Jinto",
      toPhone: admin.phone,
      toEmail: admin.email,
      userId: admin.id,
      clientId,
      body: `Message from ${senderName}:

${excerpt}`,
    });
    return;
  }

  const grower = await db.user.findFirst({
    where: { clientId, role: "CLIENT", isActive: true },
    select: { id: true, name: true, email: true, phone: true },
  });
  if (!grower) return;

  await queueNotification({
    kind: NOTIFICATION_KINDS.NEW_MESSAGE,
    toName: grower.name ?? "Grower",
    toPhone: grower.phone,
    toEmail: grower.email,
    userId: grower.id,
    clientId,
    body: `Message from ${senderName} about your estate:

${excerpt}`,
  });
}

export async function sendMessage(
  _prev: MessageState,
  formData: FormData,
): Promise<MessageState> {
  const resolved = await resolveThread(
    String(formData.get("clientId") ?? "") || null,
  );
  if ("error" in resolved) return { error: resolved.error };
  const { user, clientId } = resolved;

  const parsed = schema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the message." };
  }

  await db.message.create({
    data: {
      clientId,
      senderUserId: user.id,
      body: parsed.data.body,
    },
  });

  // Tell the other side. Queued, never sent inline: a provider having a bad
  // afternoon must not turn "your message was saved" into an error.
  await notifyOtherParty(user.role, clientId, user.name ?? "Someone", parsed.data.body);

  revalidatePath("/dashboard/messages");
  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${clientId}`);
  // Both shells carry an unread count, so the layout has to be invalidated
  // too or the badge lags a message behind.
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin", "layout");

  return { ok: true };
}

/**
 * Mark everything the viewer did not write as read.
 *
 * Called when a thread is opened. Scoped by sender so opening your own thread
 * never marks your own unanswered messages as read on the other side's behalf.
 */
export async function markThreadRead(clientId: string) {
  const user = await getCurrentUser();
  if (!user) return;

  // A grower may only ever mark their own thread.
  const scope =
    user.role === "CLIENT"
      ? user.clientId
      : user.role === "ADMIN"
        ? clientId
        : null;
  if (!scope) return;
  if (user.role === "CLIENT" && scope !== user.clientId) return;

  const from = user.role === "ADMIN" ? "CLIENT" : "ADMIN";

  const result = await db.message.updateMany({
    where: { clientId: scope, readAt: null, sender: { is: { role: from } } },
    data: { readAt: new Date() },
  });

  if (result.count > 0) {
    revalidatePath("/dashboard", "layout");
    revalidatePath("/admin", "layout");
  }
}
