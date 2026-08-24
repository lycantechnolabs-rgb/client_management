import Link from "next/link";
import { requireClient } from "@/lib/session";
import { getActivities } from "@/lib/queries";
import { db } from "@/lib/db";
import { ActivityCard } from "@/components/activity-card";
import { EmptyState } from "@/components/ui";
import { ACTIVITY_TYPES } from "@/lib/constants";
import { cn, monthLabel } from "@/lib/utils";

export const metadata = { title: "Work done" };

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; plot?: string }>;
}) {
  const user = await requireClient();
  const { type, plot } = await searchParams;

  const [activities, plots] = await Promise.all([
    getActivities(user.clientId, { type, plotId: plot }),
    db.plot.findMany({
      where: { clientId: user.clientId },
      select: { id: true, name: true },
    }),
  ]);

  // Only offer filters for types this grower actually has.
  const presentTypes = new Set(activities.map((a) => a.type));
  const availableTypes = ACTIVITY_TYPES.filter(
    (t) => presentTypes.has(t.key) || t.key === type,
  );

  const query = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { type, plot, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/dashboard/activities?${s}` : "/dashboard/activities";
  };

  // Group by month so a long history stays readable.
  const groups: { label: string; items: typeof activities }[] = [];
  for (const activity of activities) {
    const label = monthLabel(activity.date);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(activity);
    else groups.push({ label, items: [activity] });
  }

  return (
    <div className="space-y-5">
      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 pb-1">
          <FilterChip href={query({ type: undefined })} active={!type}>
            All work
          </FilterChip>
          {availableTypes.map((t) => (
            <FilterChip
              key={t.key}
              href={query({ type: t.key })}
              active={type === t.key}
            >
              {t.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {plots.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <FilterChip href={query({ plot: undefined })} active={!plot} subtle>
            All estates
          </FilterChip>
          {plots.map((p) => (
            <FilterChip
              key={p.id}
              href={query({ plot: p.id })}
              active={plot === p.id}
              subtle
            >
              {p.name}
            </FilterChip>
          ))}
        </div>
      ) : null}

      {activities.length === 0 ? (
        <EmptyState
          title="No work under this filter"
          description="Try a different type of work, or view everything."
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted">
                {group.label}
              </h2>
              <div className="space-y-3">
                {group.items.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    href={`/dashboard/activities/${activity.id}`}
                    activity={activity}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
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
        "inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-sm transition-colors",
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
