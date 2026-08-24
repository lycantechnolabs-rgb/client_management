import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CirclePlus, MessageCircle, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ActivityCard } from "@/components/activity-card";
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  SectionHeading,
  StatTile,
} from "@/components/ui";
import { kg, money, shortDate } from "@/lib/utils";
import { ClientAdminActions } from "./client-actions";
import { PlotRow, WorkerRow } from "./record-row";

export default async function ClientDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { created } = await searchParams;

  const client = await db.client.findUnique({
    where: { id },
    include: {
      // Archived rows are included so Jinto can see and restore them.
      // The counts decide whether removing something destroys history.
      plots: {
        orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
        include: { _count: { select: { activities: true } } },
      },
      workers: {
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        include: { _count: { select: { activityWorkers: true } } },
      },
      users: { select: { email: true, lastLoginAt: true, mustChangePassword: true } },
      activities: {
        orderBy: { date: "desc" },
        take: 8,
        include: {
          plot: { select: { name: true } },
          attachments: { where: { kind: "IMAGE" }, take: 3 },
          _count: { select: { attachments: true, materials: true } },
        },
      },
    },
  });

  if (!client) notFound();

  const [spend, harvest] = await Promise.all([
    db.activity.aggregate({
      where: { clientId: id },
      _sum: { totalCost: true },
    }),
    db.activity.aggregate({
      where: { clientId: id, type: "HARVEST" },
      _sum: { driedWeightKg: true, saleAmount: true },
    }),
  ]);

  const login = client.users[0];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-forest"
      >
        <ArrowLeft className="size-4" /> Clients
      </Link>

      {created ? (
        <Card className="border-success/40 bg-success/8">
          <CardBody>
            <p className="text-sm font-medium text-success">
              Client created. Give them this temporary password:
            </p>
            <p className="mt-2 font-mono text-lg text-forest">{created}</p>
            <p className="mt-1.5 text-xs text-muted">
              Send it over WhatsApp or tell them on the phone. They&rsquo;ll be
              asked to choose their own password when they first sign in. This
              is the only time it&rsquo;s shown.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl text-forest">{client.name}</h1>
            {!client.isActive ? <Badge tone="danger">Inactive</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {client.code}
            {client.village ? ` · ${client.village}, ${client.district}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {client.phone ? (
            <ButtonLink href={`tel:${client.phone}`} variant="outline" size="sm">
              <Phone className="size-4" /> Call
            </ButtonLink>
          ) : null}
          {client.whatsapp ? (
            <ButtonLink
              href={`https://wa.me/91${client.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="sm"
            >
              <MessageCircle className="size-4" /> WhatsApp
            </ButtonLink>
          ) : null}
          <ButtonLink href={`/admin/activities/new?client=${client.id}`} size="sm">
            <CirclePlus className="size-4" /> Log work
          </ButtonLink>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile tone="forest" label="Spent" value={money(spend._sum.totalCost ?? 0)} />
        <StatTile label="Dried" value={kg(harvest._sum.driedWeightKg ?? 0)} />
        <StatTile label="Sale value" value={money(harvest._sum.saleAmount ?? 0)} />
        <StatTile label="Estates" value={String(client.plots.length)} />
      </div>

      <ClientAdminActions
        clientId={client.id}
        isActive={client.isActive}
        loginEmail={login?.email}
        lastLoginAt={login?.lastLoginAt ? shortDate(login.lastLoginAt) : null}
        mustChangePassword={login?.mustChangePassword ?? false}
        plots={client.plots.map((p) => ({ id: p.id, name: p.name }))}
      />

      <section>
        <SectionHeading
          title={`Estates (${client.plots.filter((p) => p.isActive).length})`}
        />
        <Card>
          <CardBody className="p-0 sm:p-0">
            <div className="divide-y divide-line-soft">
              {client.plots.map((p) => (
                <PlotRow
                  key={p.id}
                  plot={{
                    id: p.id,
                    name: p.name,
                    location: p.location,
                    areaAcres: p.areaAcres,
                    plants: p.plants,
                    isActive: p.isActive,
                    activityCount: p._count.activities,
                  }}
                />
              ))}
              {client.plots.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted">
                  No estates yet. Add one above.
                </p>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionHeading
          title={`Workers (${client.workers.filter((w) => w.isActive).length})`}
        />
        <Card>
          <CardBody className="p-0 sm:p-0">
            <div className="divide-y divide-line-soft">
              {client.workers.map((w) => (
                <WorkerRow
                  key={w.id}
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
                  plots={client.plots
                    .filter((p) => p.isActive)
                    .map((p) => ({ id: p.id, name: p.name }))}
                />
              ))}
              {client.workers.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted">
                  No workers recorded yet.
                </p>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionHeading
          title="Recent work"
          action={
            <Link
              href={`/admin/activities?client=${client.id}`}
              className="text-sm text-moss hover:underline"
            >
              See all
            </Link>
          }
        />
        {client.activities.length === 0 ? (
          <EmptyState
            title="No work logged"
            description="Record your first visit to this estate."
            action={
              <ButtonLink href={`/admin/activities/new?client=${client.id}`}>
                Log work
              </ButtonLink>
            }
          />
        ) : (
          <div className="space-y-3">
            {client.activities.map((a) => (
              <ActivityCard
                key={a.id}
                href={`/admin/activities/${a.id}`}
                activity={a}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
