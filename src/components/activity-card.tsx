import Link from "next/link";
import Image from "next/image";
import { Camera, FlaskConical, Paperclip, Users } from "lucide-react";
import { Badge } from "@/components/ui";
import {ACTIVITY_TYPES} from "@/lib/constants";
import { cn, kg, money, shortDate } from "@/lib/utils";
import { attachmentHref } from "@/lib/files";
import { activityKinds } from "@/lib/activity-kinds";
import type { Translator } from "@/lib/i18n";
import { activityLabelIn } from "@/lib/i18n/labels";

type Props = {
  href: string;
  activity: {
    id: string;
    date: Date;
    type: string;
    title: string;
    notes: string | null;
    totalCost: number;
    labourCount: number | null;
    driedWeightKg: number | null;
    grade: string | null;
    plot?: { name: string } | null;
    attachments: { id: string; url: string; caption: string | null }[];
    /**
     * Required, not optional, and deliberately so.
     *
     * Left optional, a query that forgets to include the relation still
     * compiles and simply renders one badge — the visit silently loses the
     * other kinds of work it recorded, which is the failure nobody notices.
     * Required means the compiler names the query that forgot.
     */
    extraKinds: { key: string }[];
    /** Blocks beyond the primary. Required for the same reason as extraKinds. */
    extraPlots: { plot: { id: string; name: string } }[];
    _count?: { attachments: number; materials: number };
  };
};

export function ActivityCard({
  href,
  activity,
  t,
  locale,
  variant = "surface",
}: Props & { t: Translator; locale?: string; variant?: "surface" | "glass" }) {
  // Every kind of work done on the visit, primary first.
  const kinds = activityKinds(activity);
  // Every block the visit covered, primary first — a round that crossed a
  // boundary should not read as though it stopped at one.
  const plotNames = [
    ...(activity.plot?.name ? [activity.plot.name] : []),
    ...activity.extraPlots.map((p) => p.plot.name),
  ];
  const photoCount = activity._count?.attachments ?? activity.attachments.length;
  const materialCount = activity._count?.materials ?? 0;

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-[--radius-card] transition-colors hover:border-moss/40",
        variant === "glass" ? "glass" : "border border-line bg-surface",
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5">
              {kinds.map((key) => (
                <Badge
                  key={key}
                  tone={
                    (ACTIVITY_TYPES.find((t) => t.key === key)?.tone ??
                      "muted") as never
                  }
                >
                  {activityLabelIn(t, key)}
                </Badge>
              ))}
            </div>
            <h3 className="mt-2 font-display text-base leading-snug text-forest">
              {activity.title}
            </h3>
          </div>
          <time className="shrink-0 pt-0.5 text-xs text-muted">
            {shortDate(activity.date, locale)}
          </time>
        </div>

        {activity.notes ? (
          <p className="mt-2 line-clamp-2 text-sm text-body">{activity.notes}</p>
        ) : null}

        {activity.attachments.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {activity.attachments.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="relative aspect-[4/3] overflow-hidden rounded-lg bg-tint"
              >
                <Image
                  src={attachmentHref(a)}
                  unoptimized
                  alt={a.caption ?? ""}
                  fill
                  sizes="(max-width: 640px) 33vw, 160px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
          {plotNames.length > 0 ? (
            <span className="truncate">{plotNames.join(", ")}</span>
          ) : null}
          {photoCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Camera className="size-3.5" />
              {photoCount}
            </span>
          ) : null}
          {materialCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <FlaskConical className="size-3.5" />
              {materialCount}
            </span>
          ) : null}
          {activity.labourCount ? (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {activity.labourCount}
            </span>
          ) : null}
          {activity.driedWeightKg ? (
            <span className="inline-flex items-center gap-1 font-medium text-success">
              <Paperclip className="size-3.5" />
              {kg(activity.driedWeightKg)} {t("card.dried")}
            </span>
          ) : null}
          {activity.totalCost > 0 ? (
            <span className="ms-auto font-medium text-forest">
              {money(activity.totalCost)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
