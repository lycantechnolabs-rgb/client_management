import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { Card, CardBody, EmptyState } from "@/components/ui";
import { money, shortDate } from "@/lib/utils";

export const metadata = { title: "Workers" };

export default async function WorkersPage() {
  await requireAdmin();

  const clients = await db.client.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    include: {
      workers: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        include: { plot: { select: { name: true } } },
      },
    },
  });

  const withWorkers = clients.filter((c) => c.workers.length > 0);

  if (withWorkers.length === 0) {
    return (
      <EmptyState
        title="No workers recorded"
        description="Add workers from a client's page to keep track of who works which estate."
      />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl text-forest lg:hidden">Workers</h1>

      {withWorkers.map((client) => (
        <section key={client.id}>
          <h2 className="mb-2.5 flex items-baseline gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <Link
              href={`/admin/clients/${client.id}`}
              className="hover:text-forest"
            >
              {client.name}
            </Link>
            <span className="normal-case tracking-normal">
              · {client.workers.length}
            </span>
          </h2>
          <Card>
            <CardBody className="p-0 sm:p-0">
              <ul className="divide-y divide-line-soft">
                {client.workers.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-forest">
                        {w.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {[
                          w.role,
                          w.plot?.name,
                          w.joinedOn ? `since ${shortDate(w.joinedOn)}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {w.dailyWage ? (
                        <p className="text-sm text-body">
                          {money(w.dailyWage)}/day
                        </p>
                      ) : null}
                      {w.phone ? (
                        <a
                          href={`tel:${w.phone}`}
                          className="text-xs text-moss hover:underline"
                        >
                          {w.phone}
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </section>
      ))}
    </div>
  );
}
