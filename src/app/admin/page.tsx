import Link from "next/link";
import { ArrowRight, CirclePlus, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ActivityCard } from "@/components/activity-card";
import {
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  SectionHeading,
  StatTile,
} from "@/components/ui";
import { kg, money, relativeDays } from "@/lib/utils";
import { getRoundBoard } from "@/lib/queries";
import { RoundBoard } from "@/components/round-board";

export default async function AdminHome() {
  await requireAdmin();

  const [clients, activityCount, recent, harvest, spend, openOrders, rounds] =
    await Promise.all([
      db.client.findMany({
        where: { isActive: true },
        include: { _count: { select: { plots: true, activities: true } } },
        orderBy: { code: "asc" },
      }),
      db.activity.count(),
      db.activity.findMany({
        orderBy: { date: "desc" },
        take: 6,
        include: {
          client: { select: { name: true } },
          plot: { select: { name: true } },
          attachments: { where: { kind: "IMAGE" }, take: 3 },
          _count: { select: { attachments: true, materials: true } },
        },
      }),
      db.activity.aggregate({
        where: { type: "HARVEST" },
        _sum: { driedWeightKg: true, saleAmount: true },
      }),
      db.activity.aggregate({ _sum: { totalCost: true } }),
      db.order.count({ where: { status: { in: ["PENDING", "CONFIRMED"] } } }),
      getRoundBoard(),
    ]);

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile tone="forest" label="Active clients" value={String(clients.length)} />
        <StatTile label="Jobs recorded" value={String(activityCount)} />
        <StatTile
          label="Cardamom dried"
          value={kg(harvest._sum.driedWeightKg ?? 0)}
          sub={money(harvest._sum.saleAmount ?? 0) + " sale value"}
        />
        <StatTile
          label="Spent across estates"
          value={money(spend._sum.totalCost ?? 0)}
        />
      </div>

      {/* Field-first: logging work is the primary action */}
      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/admin/activities/new" size="lg">
          <CirclePlus className="size-4" /> Log work
        </ButtonLink>
        <ButtonLink href="/admin/clients/new" variant="outline" size="lg">
          <UserPlus className="size-4" /> Add client
        </ButtonLink>
        {openOrders > 0 ? (
          <ButtonLink href="/admin/orders" variant="soft" size="lg">
            {openOrders} order{openOrders === 1 ? "" : "s"} to pack
          </ButtonLink>
        ) : null}
      </div>

      {/* What needs doing, worked out from the 45-day picking round */}
      <RoundBoard rows={rounds} limit={8} />

      <section>
        <SectionHeading
          title="Clients"
          action={
            <Link
              href="/admin/clients"
              className="inline-flex items-center gap-1 text-sm text-moss hover:underline"
            >
              See all <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Link key={c.id} href={`/admin/clients/${c.id}`}>
              <Card className="transition-colors hover:border-moss/40">
                <CardBody>
                  <p className="font-display text-base text-forest">{c.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {c.code} · {c.village ?? "Idukki"}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {c._count.plots} estate{c._count.plots === 1 ? "" : "s"} ·{" "}
                    {c._count.activities} job
                    {c._count.activities === 1 ? "" : "s"}
                  </p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          title="Latest work"
          action={
            <Link
              href="/admin/activities"
              className="inline-flex items-center gap-1 text-sm text-moss hover:underline"
            >
              See all <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        {recent.length === 0 ? (
          <EmptyState
            title="Nothing logged yet"
            description="Record your first estate visit and it will appear here and on the grower's dashboard."
          />
        ) : (
          <div className="space-y-3">
            {recent.map((a) => (
              <div key={a.id}>
                <p className="mb-1 text-xs font-medium text-muted">
                  {a.client.name} · {relativeDays(a.date)}
                </p>
                <ActivityCard href={`/admin/activities/${a.id}`} activity={a} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
