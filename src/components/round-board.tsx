import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CircleCheck,
  PackageOpen,
  Sprout,
  SprayCan,
} from "lucide-react";
import type { PlotCycle, RoundStage } from "@/lib/cycle";
import { describeCycle } from "@/lib/cycle";
import { shortDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type RoundRow = {
  plotId: string;
  plotName: string;
  clientId: string;
  clientName: string;
  cycle: PlotCycle;
};

const STAGE_META: Record<
  RoundStage,
  { label: string; icon: typeof PackageOpen }
> = {
  HARVEST: { label: "Picking", icon: PackageOpen },
  FERTILIZER: { label: "Fertilizer", icon: Sprout },
  SPRAYING: { label: "Spray", icon: SprayCan },
};

function StatusPill({ cycle }: { cycle: PlotCycle }) {
  const map = {
    overdue: "bg-danger/12 text-danger",
    due: "bg-warning/15 text-warning",
    waiting: "bg-tint text-forest",
    "no-history": "bg-line text-muted",
  } as const;

  const label = {
    overdue: "Overdue",
    due: "Due now",
    waiting: `${cycle.daysUntilNextHarvest}d`,
    "no-history": "No history",
  } as const;

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
        map[cycle.status],
      )}
    >
      {label[cycle.status]}
    </span>
  );
}

/** The three stages of the round, with what has been done since the last picking. */
function StageTrack({ cycle }: { cycle: PlotCycle }) {
  const stages: { stage: RoundStage; done: boolean; late: boolean }[] = [
    { stage: "HARVEST", done: true, late: false },
    {
      stage: "FERTILIZER",
      done: cycle.fertilizerDone,
      late: cycle.fertilizerOverdue,
    },
    { stage: "SPRAYING", done: cycle.sprayDone, late: cycle.sprayOverdue },
  ];

  return (
    <div className="flex items-center gap-1.5">
      {stages.map((s, i) => {
        const { icon: Icon, label } = STAGE_META[s.stage];
        return (
          <div key={s.stage} className="flex items-center gap-1.5">
            <span
              title={`${label}: ${s.done ? "done" : s.late ? "overdue" : "pending"}`}
              className={cn(
                "grid size-7 place-items-center rounded-full border",
                s.done
                  ? "border-success/30 bg-success/12 text-success"
                  : s.late
                    ? "border-danger/30 bg-danger/10 text-danger"
                    : "border-line bg-cream-deep text-muted",
              )}
            >
              <Icon className="size-3.5" />
            </span>
            {i < stages.length - 1 ? (
              <span className="h-px w-3 bg-line" aria-hidden="true" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function RoundBoard({
  rows,
  showClient = true,
  limit,
}: {
  rows: RoundRow[];
  showClient?: boolean;
  limit?: number;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;
  const pressing = rows.filter(
    (r) => r.cycle.status === "due" || r.cycle.status === "overdue",
  ).length;

  return (
    <div className="overflow-hidden rounded-[--radius-card] border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
        <p className="text-sm font-medium text-forest">
          Rounds due
          {pressing > 0 ? (
            <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning">
              <AlertTriangle className="size-3" />
              {pressing} need attention
            </span>
          ) : (
            <span className="ms-2 inline-flex items-center gap-1 text-[11px] font-normal text-success">
              <CircleCheck className="size-3" />
              all on schedule
            </span>
          )}
        </p>
        <p className="hidden text-xs text-muted sm:block">
          Picking returns about every 45 days
        </p>
      </div>

      <ul className="divide-y divide-line-soft">
        {shown.map((r) => (
          <li key={r.plotId}>
            <Link
              href={`/admin/clients/${r.clientId}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-cream-deep/50 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-forest">
                  {r.plotName}
                  {showClient ? (
                    <span className="font-normal text-muted"> · {r.clientName}</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {describeCycle(r.cycle)}
                  {r.cycle.nextHarvestDue
                    ? ` · due ${shortDate(r.cycle.nextHarvestDue)}`
                    : ""}
                </p>
              </div>

              <div className="hidden sm:block">
                <StageTrack cycle={r.cycle} />
              </div>

              <StatusPill cycle={r.cycle} />
              <ArrowRight className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        ))}

        {shown.length === 0 ? (
          <li className="px-5 py-6 text-sm text-muted">
            No estates with harvest history yet.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
