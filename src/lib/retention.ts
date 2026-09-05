import { db } from "@/lib/db";
import { retentionFor } from "@/lib/dpdp";

/**
 * The s.8(7) erasure sweep, as one implementation with two callers: the button
 * in the admin and the nightly job.
 *
 * Split out of the server action for the same reason the upload validator was:
 * two copies would drift, and the copy that drifted would be the one running
 * unattended at two in the morning where nobody would notice.
 *
 * `runBy` is the user id when Jinto presses the button and null when the
 * schedule does it, so the audit log distinguishes a person from a timer.
 */

function cutoff(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export type PurgeResult = {
  orders: number;
  enquiries: number;
  logs: number;
  notifications: number;
  translations: number;
  total: number;
};

export async function purgeExpiredData(
  runBy: string | null,
): Promise<PurgeResult> {
  const orderRule = retentionFor("ORDER");
  const logRule = retentionFor("AUDIT_LOG");
  const enquiryRule = retentionFor("ENQUIRY");
  const notifyRule = retentionFor("NOTIFICATION");

  let orders = 0;

  if (orderRule?.days) {
    // Past the statutory window the financial record no longer has to name
    // anyone, so the person goes and the totals stay.
    const stale = await db.order.findMany({
      where: {
        createdAt: { lt: cutoff(orderRule.days) },
        email: { not: { startsWith: "erased+" } },
      },
      select: { id: true },
    });
    for (const order of stale) {
      await db.order.update({
        where: { id: order.id },
        data: {
          customerName: "Erased on schedule",
          email: `erased+${order.id}@invalid`,
          phone: "",
          addressLine1: "",
          addressLine2: null,
          city: "",
          state: "",
          pincode: "",
          notes: null,
        },
      });
    }
    orders = stale.length;
  }

  // Enquiries are deleted outright rather than anonymised: unlike an order
  // there is no statutory record underneath, so once the year is up there is
  // nothing left we are entitled to keep.
  const enquiries = enquiryRule?.days
    ? (
        await db.enquiry.deleteMany({
          where: { createdAt: { lt: cutoff(enquiryRule.days) } },
        })
      ).count
    : 0;

  // A notification carries the number it was sent to, which is why it expires
  // like everything else holding contact details.
  const notifications = notifyRule?.days
    ? (
        await db.notification.deleteMany({
          where: { createdAt: { lt: cutoff(notifyRule.days) } },
        })
      ).count
    : 0;

  const logs = logRule?.days
    ? (
        await db.auditLog.deleteMany({
          where: { createdAt: { lt: cutoff(logRule.days) } },
        })
      ).count
    : 0;

  /*
   * Orphaned translations.
   *
   * The cache stores the English Jinto wrote alongside its Malayalam, keyed by
   * a hash of the source. That is what makes an edit safe — a corrected note
   * hashes differently and is translated afresh. It also means the *old*
   * sentence stays in this table forever, and a note edited five times leaves
   * five copies of text that is no longer anywhere else in the system.
   *
   * Estate notes can name people. Keeping superseded copies of them
   * indefinitely, in a table nobody reads, is exactly the retention the notice
   * says we do not do. So a row whose source no longer matches any live
   * activity goes.
   *
   * Deleting a row that is still in use costs one re-translation, not
   * correctness — the cache is a cache. Erring toward deletion is right here.
   */
  const live = await db.activity.findMany({ select: { title: true, notes: true } });
  const captions = await db.attachment.findMany({
    where: { caption: { not: null } },
    select: { caption: true },
  });
  const inUse = new Set<string>();
  for (const a of live) {
    if (a.title) inUse.add(a.title.trim());
    if (a.notes) inUse.add(a.notes.trim());
  }
  for (const c of captions) if (c.caption) inUse.add(c.caption.trim());

  const cached = await db.contentTranslation.findMany({
    select: { hash: true, source: true },
  });
  const orphaned = cached.filter((row) => !inUse.has(row.source)).map((r) => r.hash);
  const translations = orphaned.length
    ? (await db.contentTranslation.deleteMany({ where: { hash: { in: orphaned } } }))
        .count
    : 0;

  const total = orders + enquiries + notifications + logs + translations;

  await db.auditLog.create({
    data: {
      userId: runBy,
      action: "DPDP_RETENTION_PURGE",
      meta: JSON.stringify({
        orders,
        enquiries,
        notifications,
        logs,
        translations,
        by: runBy ? "admin" : "schedule",
      }),
    },
  });

  return { orders, enquiries, logs, notifications, translations, total };
}

export function describePurge(r: PurgeResult) {
  if (r.total === 0) return "Nothing is past its retention period yet.";
  const parts = [
    `${r.orders} order(s) anonymised`,
    `${r.enquiries} enquiry(ies)`,
    `${r.notifications} notification(s)`,
    `${r.logs} old log line(s)`,
  ];
  // Only mentioned when there were any: translation is off in most deployments
  // and a permanent "0 stale translation(s)" would be noise in the one line
  // Jinto actually reads.
  if (r.translations > 0) parts.push(`${r.translations} stale translation(s)`);
  return `${parts.join(", ")} deleted.`;
}
