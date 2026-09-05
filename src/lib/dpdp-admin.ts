import { db } from "@/lib/db";
import { retentionFor } from "@/lib/dpdp";

/**
 * Everything the admin privacy screen needs, assembled outside any component.
 *
 * "Is this request overdue" depends on the clock, and reading the clock while
 * a component renders is exactly the impurity React now rejects — the answer
 * would change between two renders of the same data. Working it out here, once
 * per request, keeps the page a pure function of what it is handed.
 */

export type AdminRequestRow = {
  id: string;
  reference: string;
  name: string;
  subject: string;
  phone: string | null;
  clientId: string | null;
  kind: string;
  details: string | null;
  status: string;
  response: string | null;
  createdAt: string;
  dueBy: string;
  overdue: boolean;
};

export type BreachRow = {
  id: string;
  reference: string;
  detectedAt: string;
  description: string;
  affected: number;
  boardNotifiedAt: string | null;
  principalsNotifiedAt: string | null;
  remediation: string | null;
  closedAt: string | null;
};

function cutoff(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

const OPEN_STATUSES = ["RECEIVED", "IN_PROGRESS"];

export async function loadPrivacyDashboard() {
  const now = Date.now();

  const orderRule = retentionFor("ORDER");
  const logRule = retentionFor("AUDIT_LOG");
  const enquiryRule = retentionFor("ENQUIRY");

  const [requests, breaches, staleOrders, staleLogs, staleEnquiries] =
    await Promise.all([
    db.dataRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.breachRecord.findMany({ orderBy: { detectedAt: "desc" }, take: 25 }),
    orderRule?.days
      ? db.order.count({
          where: {
            createdAt: { lt: cutoff(orderRule.days) },
            email: { not: { startsWith: "erased+" } },
          },
        })
      : Promise.resolve(0),
    logRule?.days
      ? db.auditLog.count({ where: { createdAt: { lt: cutoff(logRule.days) } } })
      : Promise.resolve(0),
    enquiryRule?.days
      ? db.enquiry.count({
          where: { createdAt: { lt: cutoff(enquiryRule.days) } },
        })
      : Promise.resolve(0),
  ]);

  return {
    requests: requests.map(
      (r): AdminRequestRow => ({
        id: r.id,
        reference: r.reference,
        name: r.name,
        subject: r.subject,
        phone: r.phone,
        clientId: r.clientId,
        kind: r.kind,
        details: r.details,
        status: r.status,
        response: r.response,
        createdAt: r.createdAt.toISOString(),
        dueBy: r.dueBy.toISOString(),
        overdue: r.dueBy.getTime() < now && OPEN_STATUSES.includes(r.status),
      }),
    ),
    breaches: breaches.map(
      (b): BreachRow => ({
        id: b.id,
        reference: b.reference,
        detectedAt: b.detectedAt.toISOString(),
        description: b.description,
        affected: b.affected,
        boardNotifiedAt: b.boardNotifiedAt?.toISOString() ?? null,
        principalsNotifiedAt: b.principalsNotifiedAt?.toISOString() ?? null,
        remediation: b.remediation,
        closedAt: b.closedAt?.toISOString() ?? null,
      }),
    ),
    due: { orders: staleOrders, logs: staleLogs, enquiries: staleEnquiries },
  };
}
