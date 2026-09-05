import { db } from "@/lib/db";
import { activeProvider, providerName } from "@/lib/notify-providers";

/**
 * Queueing and sending notifications.
 *
 * On DPDP, because this is personal data leaving the building:
 *
 * Everything here is *transactional* — a message about your own estate, an
 * enquiry you sent us, a right you exercised. That is part of the service the
 * grower or customer asked for, and it rides on the same basis as the rest of
 * their account. What it is not, and must never quietly become, is marketing.
 * Marketing needs its own consent under s.6, and there is deliberately no
 * "send to everyone" function in this file for someone to reach for.
 *
 * The recipient's number is copied onto the row rather than joined at send
 * time, so the outbox records where a message actually went even after the
 * person changes their details.
 */

export const NOTIFICATION_KINDS = {
  NEW_MESSAGE: "NEW_MESSAGE",
  NEW_ENQUIRY: "NEW_ENQUIRY",
  ROUNDS_DUE: "ROUNDS_DUE",
  DATA_REQUEST: "DATA_REQUEST",
} as const;

export type NotificationKind =
  (typeof NOTIFICATION_KINDS)[keyof typeof NOTIFICATION_KINDS];

type QueueInput = {
  kind: NotificationKind;
  body: string;
  toName: string;
  toPhone?: string | null;
  toEmail?: string | null;
  userId?: string | null;
  clientId?: string | null;
  /** Anything scheduled should pass one, so a re-run cannot double-send. */
  dedupeKey?: string;
};

/**
 * Put a notification in the outbox.
 *
 * Never throws. A notification failing to queue must not take down the action
 * that triggered it — a grower's message is saved whether or not we manage to
 * tell Jinto about it, and the reverse would be a much worse bug than a missed
 * alert.
 */
export async function queueNotification(input: QueueInput) {
  try {
    if (input.dedupeKey) {
      const existing = await db.notification.findUnique({
        where: { dedupeKey: input.dedupeKey },
        select: { id: true },
      });
      if (existing) return { queued: false, reason: "duplicate" as const };
    }

    await db.notification.create({
      data: {
        channel: providerName().toUpperCase(),
        kind: input.kind,
        body: input.body,
        toName: input.toName,
        toPhone: input.toPhone ?? null,
        toEmail: input.toEmail ?? null,
        userId: input.userId ?? null,
        clientId: input.clientId ?? null,
        dedupeKey: input.dedupeKey ?? null,
      },
    });

    return { queued: true };
  } catch (e) {
    console.error("[notify] could not queue:", e);
    return { queued: false, reason: "error" as const };
  }
}

/** Jinto — the recipient for everything addressed to the business. */
export async function adminRecipient() {
  const admin = await db.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, phone: true, email: true },
  });
  return admin;
}

/* -------------------------------------------------------------------------- */
/* Dispatch                                                                    */
/* -------------------------------------------------------------------------- */

const MAX_ATTEMPTS = 5;

/**
 * Send what is waiting.
 *
 * Called by the scheduled job, and safe to call twice: rows are claimed by
 * moving them out of PENDING before the provider is touched, so two overlapping
 * runs cannot both send the same one.
 *
 * A row that has failed MAX_ATTEMPTS times stops being retried and stays FAILED
 * with its last error, where the admin can see it. Retrying for ever would turn
 * one bad phone number into an endless log of the same failure.
 */
export async function dispatchNotifications(limit = 50) {
  const provider = activeProvider();

  const pending = await db.notification.findMany({
    where: { status: "PENDING", attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;

  for (const row of pending) {
    // Claim it first. If another run already moved it, updateMany reports zero
    // and this one leaves it alone.
    const claimed = await db.notification.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "SENDING", attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    const result = await provider.send({
      id: row.id,
      kind: row.kind,
      toName: row.toName,
      toPhone: row.toPhone,
      toEmail: row.toEmail,
      body: row.body,
    });

    if (result.ok) {
      await db.notification.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          channel: provider.channel,
          lastError: null,
        },
      });
      sent += 1;
    } else {
      const attempts = row.attempts + 1;
      await db.notification.update({
        where: { id: row.id },
        data: {
          // Back to PENDING while retries remain, so the next run picks it up.
          status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
          lastError: result.error.slice(0, 500),
        },
      });
      failed += 1;
    }
  }

  return { considered: pending.length, sent, failed };
}
