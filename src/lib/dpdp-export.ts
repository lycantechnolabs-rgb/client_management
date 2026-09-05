import { db } from "@/lib/db";
import { NOTICE_VERSION, PURPOSES, RETENTION } from "@/lib/dpdp";
import { activityKindLabels } from "@/lib/activity-kinds";

/**
 * Assembling the s.11 answer: "a summary of the personal data being processed
 * and the processing activities undertaken".
 *
 * Two rules govern everything below.
 *
 * First, the export is built from the session's client ID, never from an ID in
 * the request — the same rule the rest of the portal lives by. A data-access
 * right that could be pointed at someone else's row would be the single worst
 * thing to get wrong here, because it would hand over exactly the data it
 * exists to protect.
 *
 * Second, it never includes a credential. The password hash is personal data
 * in the sense that it relates to the person, but returning it would degrade
 * the security safeguards s.8(5) requires. A summary is owed; the key is not.
 */

export type DataExport = {
  generatedAt: string;
  noticeVersion: string;
  about: Record<string, unknown>;
  sections: { title: string; note?: string; rows: Record<string, unknown>[] }[];
  purposes: { purpose: string; basis: string; data: string[] }[];
  retention: { data: string; kept: string; why: string }[];
};

function purposeSummary() {
  return PURPOSES.map((p) => ({
    purpose: p.label,
    basis: p.basis === "CONSENT" ? `Consent (${p.basisNote})` : p.basisNote,
    data: p.data,
  }));
}

function retentionSummary() {
  return RETENTION.map((r) => ({
    data: r.label,
    kept: r.days === null ? "While it is needed" : `${Math.round(r.days / 365)} year(s)`,
    why: r.reason,
  }));
}

/** Everything held about one grower. `clientId` must come from the session. */
export async function buildGrowerExport(clientId: string): Promise<DataExport> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    include: {
      users: {
        select: {
          name: true,
          email: true,
          phone: true,
          role: true,
          lastLoginAt: true,
          createdAt: true,
          // passwordHash is deliberately absent — see the note above.
        },
      },
      plots: true,
      workers: true,
    },
  });

  if (!client) throw new Error("Not found");

  const [activities, attachments, consents, requests, messages, auditLogs] =
    await Promise.all([
      db.activity.findMany({
        where: { clientId },
        orderBy: { date: "desc" },
        include: {
          materials: true,
          workers: { include: { worker: true } },
          extraKinds: { select: { key: true } },
        },
      }),
      db.attachment.findMany({
        where: { clientId },
        select: {
          filename: true,
          kind: true,
          caption: true,
          category: true,
          sizeBytes: true,
          createdAt: true,
        },
      }),
      db.consentRecord.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
      }),
      db.dataRequest.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        select: {
          reference: true,
          kind: true,
          status: true,
          details: true,
          response: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      db.message.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        select: { body: true, createdAt: true, readAt: true },
      }),
      db.auditLog.findMany({
        where: { user: { clientId } },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { action: true, entity: true, createdAt: true },
      }),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    noticeVersion: NOTICE_VERSION,
    about: {
      reference: client.code,
      name: client.name,
      phone: client.phone,
      whatsapp: client.whatsapp,
      email: client.email,
      address: client.address,
      village: client.village,
      district: client.district,
      notesWeKeep: client.notes,
      nominee: client.nomineeName
        ? {
            name: client.nomineeName,
            phone: client.nomineePhone,
            relationship: client.nomineeRelation,
          }
        : null,
      accountOpened: client.createdAt,
    },
    sections: [
      {
        title: "Sign-in accounts",
        note: "Passwords are stored only as a one-way hash and are never included here.",
        rows: client.users,
      },
      { title: "Estates", rows: client.plots },
      {
        title: "Workers recorded on your estates",
        note: "These are other people's details, held so that days worked and wages can be recorded.",
        rows: client.workers,
      },
      {
        title: "Work recorded on your estates",
        rows: activities.map((a) => ({
          date: a.date,
          // Every kind of work on the visit, not just the primary one: this is
          // the grower's own record under s.11, and it should say what was
          // actually done rather than the first thing on the list.
          type: activityKindLabels(a).join(", "),
          title: a.title,
          notes: a.notes,
          totalCost: a.totalCost,
          materials: a.materials.map((m) => `${m.name} ${m.quantity}${m.unit}`),
          workers: a.workers.map((w) => w.worker.name),
        })),
      },
      {
        title: "Photographs and documents",
        note: "The files themselves are downloadable from the portal; this lists what exists.",
        rows: attachments,
      },
      { title: "Messages", rows: messages },
      { title: "Consent records", rows: consents },
      { title: "Requests you have made", rows: requests },
      {
        title: "Access log",
        note: "The 200 most recent security events on your account.",
        rows: auditLogs,
      },
    ],
    purposes: purposeSummary(),
    retention: retentionSummary(),
  };
}

/**
 * Everything held about a store customer.
 *
 * A guest customer has no account, so identity is proved the same way order
 * tracking already proves it: the order number AND the email must match. That
 * pairing is the reason this cannot be called with an email alone — an email
 * on its own is a guess, and answering a guess is a data breach.
 */
export async function buildCustomerExport(
  orderNumber: string,
  email: string,
): Promise<DataExport | null> {
  const normalisedEmail = email.trim().toLowerCase();

  const order = await db.order.findFirst({
    where: {
      orderNumber: orderNumber.trim().toUpperCase(),
      email: normalisedEmail,
    },
    include: { items: true },
  });

  if (!order) return null;

  // Only orders proved by this same email — one lookup does not unlock a
  // stranger's order history.
  const allOrders = await db.order.findMany({
    where: { email: normalisedEmail },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  const consents = await db.consentRecord.findMany({
    where: { subject: normalisedEmail },
    orderBy: { createdAt: "desc" },
  });

  return {
    generatedAt: new Date().toISOString(),
    noticeVersion: NOTICE_VERSION,
    about: {
      name: order.customerName,
      email: order.email,
      phone: order.phone,
      address: [
        order.addressLine1,
        order.addressLine2,
        order.city,
        order.state,
        order.pincode,
      ]
        .filter(Boolean)
        .join(", "),
    },
    sections: [
      {
        title: "Your orders",
        rows: allOrders.map((o) => ({
          orderNumber: o.orderNumber,
          placed: o.createdAt,
          status: o.status,
          paymentStatus: o.paymentStatus,
          total: o.total,
          items: o.items.map(
            (i) => `${i.productName} ${i.variantLabel} x${i.quantity}`,
          ),
          deliveryNotes: o.notes,
        })),
      },
      { title: "Consent records", rows: consents },
    ],
    purposes: purposeSummary().filter((p) =>
      p.purpose.includes("cardamom you ordered"),
    ),
    retention: retentionSummary().filter((r) => r.data.includes("orders")),
  };
}
