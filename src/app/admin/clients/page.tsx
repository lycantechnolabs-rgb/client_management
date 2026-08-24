import Link from "next/link";
import { UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
} from "@/components/ui";
import { money, relativeDays } from "@/lib/utils";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  await requireAdmin();

  const clients = await db.client.findMany({
    orderBy: [{ isActive: "desc" }, { code: "asc" }],
    include: {
      _count: { select: { plots: true, activities: true, workers: true } },
      activities: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
    },
  });

  const spendByClient = await db.activity.groupBy({
    by: ["clientId"],
    _sum: { totalCost: true },
  });
  const spend = new Map(
    spendByClient.map((s) => [s.clientId, s._sum.totalCost ?? 0]),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl text-forest lg:hidden">Clients</h1>
        <ButtonLink href="/admin/clients/new" className="ms-auto">
          <UserPlus className="size-4" /> Add client
        </ButtonLink>
      </div>

      {clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="Add the first grower whose estate you manage."
          action={<ButtonLink href="/admin/clients/new">Add client</ButtonLink>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Link key={c.id} href={`/admin/clients/${c.id}`}>
              <Card className="h-full transition-colors hover:border-moss/40">
                <CardBody>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-display text-base text-forest">
                        {c.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {c.code} · {c.village ?? "Idukki"}
                      </p>
                    </div>
                    {!c.isActive ? (
                      <Badge tone="danger">Inactive</Badge>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                    <span>
                      {c._count.plots} estate{c._count.plots === 1 ? "" : "s"}
                    </span>
                    <span>{c._count.activities} jobs</span>
                    <span>{c._count.workers} workers</span>
                  </div>

                  <div className="mt-2.5 flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted">
                      {c.activities[0]
                        ? `Last visit ${relativeDays(c.activities[0].date).toLowerCase()}`
                        : "No visits yet"}
                    </span>
                    <span className="text-sm font-medium text-forest">
                      {money(spend.get(c.id) ?? 0)}
                    </span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
