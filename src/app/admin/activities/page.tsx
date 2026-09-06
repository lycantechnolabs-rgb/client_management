import Link from "next/link";
import { CirclePlus } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ActivityCard } from "@/components/activity-card";
import { ButtonLink, EmptyState } from "@/components/ui";
import { ACTIVITY_TYPES } from "@/lib/constants";
import { cn, monthLabel } from "@/lib/utils";
import { kindFilter } from "@/lib/activity-kinds";
import { englishT } from "@/lib/i18n";

export const metadata = { title: "Work log" };

// Work grows one visit at a time and never stops — a findMany with no limit
// here fetches the whole company's history, on every load, forever. Fine at
// 22 rows; not fine a year in. Page it instead.
const PAGE_SIZE = 50;

export default async function AdminActivities({
  searchParams,
}: {
  searchParams: Promise<{
    client?: string;
    type?: string;
    saved?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const { client, type, saved, page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const where = {
    ...(client ? { clientId: client } : {}),
    ...(type ? kindFilter(type) : {}),
  };

  const [activities, total, clients] = await Promise.all([
    db.activity.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { id: true, name: true } },
        plot: { select: { name: true } },
        attachments: { where: { kind: "IMAGE" }, take: 3 },
        extraKinds: { select: { key: true } },
        extraPlots: { select: { plot: { select: { id: true, name: true } } } },
        _count: { select: { attachments: true, materials: true } },
      },
    }),
    db.activity.count({ where }),
    db.client.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const hasNextPage = page * PAGE_SIZE < total;

  const query = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    // Changing a filter starts back at page 1 — a page number that made
    // sense for one filter rarely lines up with the results for another.
    const merged = { client, type, page: "1", ...next };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/admin/activities?${s}` : "/admin/activities";
  };

  const groups: { label: string; items: typeof activities }[] = [];
  for (const a of activities) {
    const label = monthLabel(a.date);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(a);
    else groups.push({ label, items: [a] });
  }

  const presentTypes = new Set(activities.map((a) => a.type));

  return (
    <div className="space-y-5">
      {saved ? (
        <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          Saved. It&rsquo;s live on the grower&rsquo;s dashboard now.
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl text-forest lg:hidden">Work log</h1>
        <ButtonLink href="/admin/activities/new" className="ms-auto">
          <CirclePlus className="size-4" /> Log work
        </ButtonLink>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 pb-1">
          <Chip href={query({ client: undefined })} active={!client}>
            All clients
          </Chip>
          {clients.map((c) => (
            <Chip
              key={c.id}
              href={query({ client: c.id })}
              active={client === c.id}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 pb-1">
          <Chip href={query({ type: undefined })} active={!type} subtle>
            All work
          </Chip>
          {ACTIVITY_TYPES.filter(
            (t) => presentTypes.has(t.key) || t.key === type,
          ).map((t) => (
            <Chip
              key={t.key}
              href={query({ type: t.key })}
              active={type === t.key}
              subtle
            >
              {t.label}
            </Chip>
          ))}
        </div>
      </div>

      {activities.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description="No work matches this filter yet."
          action={
            <ButtonLink href="/admin/activities/new">Log work</ButtonLink>
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted">
                {group.label}
              </h2>
              <div className="space-y-3">
                {group.items.map((a) => (
                  <div key={a.id}>
                    <p className="mb-1 text-xs font-medium text-muted">
                      {a.client.name}
                    </p>
                    <ActivityCard
                t={englishT}
                      href={`/admin/activities/${a.id}`}
                      activity={a}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {page > 1 || hasNextPage ? (
        <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-4">
          {page > 1 ? (
            <ButtonLink href={query({ page: String(page - 1) })} variant="outline">
              Newer
            </ButtonLink>
          ) : (
            <span />
          )}
          <p className="text-xs text-muted">
            Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))} ·{" "}
            {total} in total
          </p>
          {hasNextPage ? (
            <ButtonLink href={query({ page: String(page + 1) })} variant="outline">
              Older
            </ButtonLink>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}

function Chip({
  href,
  active,
  subtle,
  children,
}: {
  href: string;
  active: boolean;
  subtle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-sm",
        active
          ? "border-forest bg-forest text-cream"
          : "border-line bg-surface text-body hover:border-moss/40",
        subtle && !active && "bg-transparent",
      )}
    >
      {children}
    </Link>
  );
}
