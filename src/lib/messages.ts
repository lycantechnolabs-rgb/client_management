import { db } from "@/lib/db";

/**
 * Messages between Jinto and a grower.
 *
 * There is one conversation per client, not a general inbox: every message
 * belongs to an estate relationship, and threading by subject would invent a
 * structure neither side thinks in. Jinto has four growers, and each of them
 * has exactly one person to talk to.
 *
 * Read state rides on the single `readAt` column, which means it can only
 * describe one side. That is enough here because each message has exactly one
 * recipient — the party who did not send it — so "read" is unambiguous. It
 * would stop being enough the moment a third role joined a conversation, which
 * is worth remembering before Manager or Support Staff arrive.
 */

export type ThreadMessage = {
  id: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  senderName: string;
  senderRole: string;
  /** True when the signed-in viewer wrote it — decides which side it sits on. */
  mine: boolean;
};

export async function getThread(
  clientId: string,
  viewerUserId: string,
): Promise<ThreadMessage[]> {
  const rows = await db.message.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { name: true, role: true } } },
  });

  return rows.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    readAt: m.readAt?.toISOString() ?? null,
    senderName: m.sender.name,
    senderRole: m.sender.role,
    mine: m.senderUserId === viewerUserId,
  }));
}

/**
 * How many messages are waiting for this viewer.
 *
 * Counts by who sent it rather than by who is asking: a message is unread for
 * the person who did not write it, and counting "readAt is null" alone would
 * make Jinto's own unanswered messages show up as his own unread mail.
 */
export async function unreadForClient(clientId: string) {
  return db.message.count({
    where: { clientId, readAt: null, sender: { role: "ADMIN" } },
  });
}

export async function unreadForAdmin(clientId?: string) {
  return db.message.count({
    where: {
      ...(clientId ? { clientId } : {}),
      readAt: null,
      sender: { role: "CLIENT" },
    },
  });
}

/** The admin's conversation list: one row per grower, newest activity first. */
export async function listConversations() {
  const clients = await db.client.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, village: true },
  });

  const rows = await Promise.all(
    clients.map(async (client) => {
      const [last, unread] = await Promise.all([
        db.message.findFirst({
          where: { clientId: client.id },
          orderBy: { createdAt: "desc" },
          include: { sender: { select: { name: true, role: true } } },
        }),
        unreadForAdmin(client.id),
      ]);

      return {
        client,
        unread,
        last: last
          ? {
              body: last.body,
              createdAt: last.createdAt.toISOString(),
              fromAdmin: last.sender.role === "ADMIN",
            }
          : null,
      };
    }),
  );

  // Unread first, then most recent. A grower waiting on a reply should never
  // be below one who is not.
  return rows.sort((a, b) => {
    if (a.unread !== b.unread) return b.unread - a.unread;
    const at = a.last ? Date.parse(a.last.createdAt) : 0;
    const bt = b.last ? Date.parse(b.last.createdAt) : 0;
    return bt - at;
  });
}
