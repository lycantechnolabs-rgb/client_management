import { db } from "@/lib/db";
import { Badge, Card, CardBody, CardTitle } from "@/components/ui";
import { providerName } from "@/lib/notify-providers";
import { shortDate } from "@/lib/utils";

/**
 * What the app has tried to send, and whether it got there.
 *
 * On this page rather than a nav entry of its own, because the question it
 * answers — "where did this person's details go, and when" — is the same
 * question the rest of the screen answers.
 *
 * The banner about the driver is not decoration. With NOTIFY_DRIVER unset every
 * row below says SENT while nothing has left the building, and somebody would
 * eventually mistake that for growers having been told.
 */
export async function NotificationOutbox() {
  const [recent, counts] = await Promise.all([
    db.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        kind: true,
        channel: true,
        toName: true,
        toPhone: true,
        status: true,
        attempts: true,
        lastError: true,
        createdAt: true,
      },
    }),
    db.notification.groupBy({ by: ["status"], _count: true }),
  ]);

  const driver = providerName();
  const failed = counts.find((c) => c.status === "FAILED")?._count ?? 0;
  const pending = counts.find((c) => c.status === "PENDING")?._count ?? 0;

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Notifications</CardTitle>
          <span className="flex flex-wrap gap-2">
            {pending > 0 ? <Badge tone="info">{pending} waiting</Badge> : null}
            {failed > 0 ? <Badge tone="danger">{failed} failed</Badge> : null}
          </span>
        </div>

        {driver === "console" ? (
          <p className="rounded-lg bg-warning/10 px-3 py-2.5 text-sm text-body">
            <span className="font-medium text-warning">
              Nothing is actually being sent.
            </span>{" "}
            NOTIFY_DRIVER is unset, so notifications are written to the server
            log and marked sent. Set it to <code>whatsapp</code> with a
            provisioned number to reach real phones.
          </p>
        ) : (
          <p className="text-sm text-body">
            Sending over <strong>{driver}</strong>.
          </p>
        )}

        {recent.length === 0 ? (
          <p className="text-sm text-muted">Nothing queued yet.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {recent.map((n) => (
              <li key={n.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      n.status === "SENT"
                        ? "success"
                        : n.status === "FAILED"
                          ? "danger"
                          : "info"
                    }
                  >
                    {n.status.toLowerCase()}
                  </Badge>
                  <span className="text-sm text-body">
                    {n.kind.replace(/_/g, " ").toLowerCase()}
                  </span>
                  <span className="text-xs text-muted">
                    → {n.toName}
                    {n.toPhone ? ` · ${n.toPhone}` : ""} · {shortDate(n.createdAt)}
                    {n.attempts > 1 ? ` · ${n.attempts} attempts` : ""}
                  </span>
                </div>
                {n.lastError ? (
                  <p className="mt-1 text-xs text-danger">{n.lastError}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted">
          Queued by the app, sent by the nightly job at <code>/api/cron</code>.
        </p>
      </CardBody>
    </Card>
  );
}
