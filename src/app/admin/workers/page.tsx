import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { Card, CardBody, EmptyState } from "@/components/ui";
import { AddWorkerPanel } from "./add-worker-panel";
import { WorkerRow } from "../clients/[id]/record-row";

export const metadata = { title: "Workers" };

export default async function WorkersPage() {
  await requireAdmin();

  const clients = await db.client.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    include: {
      plots: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
      workers: {
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        include: { _count: { select: { activityWorkers: true } } },
      },
    },
  });

  const withWorkers = clients.filter((c) => c.workers.length > 0);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl text-forest lg:hidden">Workers</h1>

      <AddWorkerPanel
        clients={clients.map((c) => ({ id: c.id, name: c.name, plots: c.plots }))}
      />

      {withWorkers.length === 0 ? (
        <EmptyState
          title="No workers recorded"
          description="Add a worker above to keep track of who works which estate."
        />
      ) : (
        withWorkers.map((client) => (
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
                    <li key={w.id}>
                      <WorkerRow
                        worker={{
                          id: w.id,
                          name: w.name,
                          phone: w.phone,
                          role: w.role,
                          plotId: w.plotId,
                          dailyWage: w.dailyWage,
                          isActive: w.isActive,
                          daysLogged: w._count.activityWorkers,
                        }}
                        plots={client.plots}
                      />
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
