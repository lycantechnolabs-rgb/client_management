import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CloudSun,
  Download,
  FileText,
  MapPin,
  Users,
} from "lucide-react";
import { requireClient } from "@/lib/session";
import { attachmentHref } from "@/lib/files";
import { getActivityForClient } from "@/lib/queries";
import { Badge, Card, CardBody, Divider, SectionHeading } from "@/components/ui";
import { VideoPlayer } from "@/components/video-player";
import { ACTIVITY_TYPES } from "@/lib/constants";
import { kg, money, shortDate } from "@/lib/utils";
import { activityKinds, hasKind } from "@/lib/activity-kinds";
import { getI18n } from "@/lib/i18n";
import { activityLabelIn, materialCategoryIn } from "@/lib/i18n/labels";
import { materialCategories } from "@/lib/material-categories";
import { translateActivity, translateCaptions } from "@/lib/translate/activities";

export default async function ActivityDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { locale, t } = await getI18n();
  const user = await requireClient();
  const { id } = await params;

  // Scoped by clientId — another grower's activity simply doesn't exist here.
  const found = await getActivityForClient(user.clientId, id);
  // The notes matter most here — this is the page a grower opened deliberately
  // to read what was done. Captions travel with it: on this page the picture
  // and its caption are the record.
  const activity = found && (await translateActivity(found, locale));
  if (!activity) notFound();

  const plotNames = [
    ...(activity.plot?.name ? [activity.plot.name] : []),
    ...activity.extraPlots.map((p) => p.plot.name),
  ];

  // Captions, in the reader's language. translateActivity covers the title and
  // notes; a caption belongs to the attachment, not the activity, so it needs
  // its own pass — and on this page the picture and its caption together are
  // the record of what happened.
  const [images, videos] = await Promise.all([
    translateCaptions(
      activity.attachments.filter((a) => a.kind === "IMAGE"),
      locale,
    ),
    translateCaptions(
      activity.attachments.filter((a) => a.kind === "VIDEO"),
      locale,
    ),
  ]);
  const docs = activity.attachments.filter((a) => a.kind === "DOCUMENT");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/dashboard/activities"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-forest"
      >
        <ArrowLeft className="size-4" /> All work
      </Link>

      <header>
        <div className="flex flex-wrap gap-1.5">
          {activityKinds(activity).map((key) => (
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
        <h1 className="mt-2 font-display text-2xl leading-tight text-forest">
          {activity.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <time>{shortDate(activity.date, locale)}</time>
          {plotNames.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {plotNames.join(", ")}
            </span>
          ) : null}
          {activity.weather ? (
            <span className="inline-flex items-center gap-1">
              <CloudSun className="size-3.5" />
              {activity.weather}
            </span>
          ) : null}
        </div>
      </header>

      {activity.notes ? (
        <Card variant="glass">
          <CardBody>
            <p className="whitespace-pre-line leading-relaxed text-body">
              {activity.notes}
            </p>
            <p className="mt-3 text-xs text-muted">
              {t("visit.recordedBy")} {activity.createdBy.name}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {images.length > 0 ? (
        <section>
          <SectionHeading title={`${t("photos.photosCount")} (${images.length})`} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {images.map((img) => (
              <figure
                key={img.id}
                className="relative aspect-[4/3] overflow-hidden rounded-xl bg-tint"
              >
                <Image
                  src={attachmentHref(img)}
                  alt={img.caption ?? activity.title}
                  fill
                  sizes="(max-width: 640px) 50vw, 240px"
                  className="object-cover"
                  // The optimizer fetches server-side without the session
                  // cookie, so it would 404 on the authorizing route. Let the
                  // browser fetch these itself.
                  unoptimized
                />
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {videos.length > 0 ? (
        <section>
          <SectionHeading title={t("photos.videosCount")} />
          <div className="space-y-2">
            {videos.map((v) => (
              <VideoPlayer
                key={v.id}
                src={attachmentHref(v)}
                caption={v.caption}
                downloadWord={t("video.download")}
                cannotPlayWord={t("video.cannotPlay")}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Harvest */}
      {hasKind(activity, "HARVEST") ? (
        <section>
          <SectionHeading title={t("visit.harvestRecord")} />
          <Card variant="glass">
            <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label={t("visit.greenWeight")} value={kg(activity.greenWeightKg)} />
              <Stat label={t("visit.afterCuring")} value={kg(activity.driedWeightKg)} />
              <Stat label={t("visit.rate")} value={money(activity.ratePerKg)} />
              <Stat
                label={t("visit.saleValue")}
                value={money(activity.saleAmount)}
                strong
              />
              {/*
                What the round was graded into, lot by lot. A grower reading
                one grade for a picking split three ways cannot check the
                figure against what they were paid.
              */}
              {activity.grades.length > 0 ? (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-xs text-muted">{t("visit.gradedInto")}</p>
                  <ul className="mt-1 space-y-1 text-sm text-body">
                    {activity.grades.map((g) => (
                      <li key={g.id} className="flex flex-wrap justify-between gap-2">
                        <span className="font-medium text-forest">{g.grade}</span>
                        <span>
                          {kg(g.driedKg)}
                          {g.ratePerKg != null ? ` at ${money(g.ratePerKg)}/kg` : ""}
                          {g.saleAmount != null ? ` · ${money(g.saleAmount)}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : activity.grade ? (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-xs text-muted">{t("visit.grade")}</p>
                  <p className="mt-0.5 text-sm font-medium text-forest">
                    {activity.grade}
                  </p>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </section>
      ) : null}

      {/* Inputs applied */}
      {activity.materials.length > 0 ? (
        <section>
          <SectionHeading title={t("visit.inputsApplied")} />
          <Card variant="glass">
            <CardBody className="p-0 sm:p-0">
              {activity.materials.map((m, i) => (
                <div key={m.id}>
                  {i > 0 ? <Divider /> : null}
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-forest">
                        {m.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {materialCategories(m).map((k: string) => materialCategoryIn(t, k)).join(" · ").toLowerCase()}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm text-body">
                        {m.quantity} {m.unit}
                      </p>
                      {m.cost ? (
                        <p className="text-xs text-muted">{money(m.cost)}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </section>
      ) : null}

      {/* Workers */}
      {activity.workers.length > 0 ? (
        <section>
          <SectionHeading title={t("visit.whoWorked")} />
          <Card variant="glass">
            <CardBody className="flex flex-wrap gap-2">
              {activity.workers.map((aw) => (
                <span
                  key={aw.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 text-sm text-forest"
                >
                  <Users className="size-3.5" />
                  {aw.worker.name}
                  {aw.worker.role ? (
                    <span className="text-xs text-muted">· {aw.worker.role}</span>
                  ) : null}
                </span>
              ))}
            </CardBody>
          </Card>
        </section>
      ) : null}

      {/* Cost — the client sees exactly what was spent */}
      {activity.totalCost > 0 ? (
        <section>
          <SectionHeading title={t("visit.cost")} />
          <Card variant="glass">
            <CardBody className="space-y-2.5">
              <Row label={t("visit.labour")} value={money(activity.labourCost)} />
              <Row label={t("visit.materials")} value={money(activity.materialCost)} />
              {activity.otherCost ? (
                <Row label={t("visit.other")} value={money(activity.otherCost)} />
              ) : null}
              <Divider className="my-1" />
              <div className="flex items-center justify-between">
                <span className="font-medium text-forest">{t("visit.total")}</span>
                <span className="font-display text-xl text-forest">
                  {money(activity.totalCost)}
                </span>
              </div>
            </CardBody>
          </Card>
        </section>
      ) : null}

      {docs.length > 0 ? (
        <section>
          <SectionHeading title={t("docs.title")} />
          <div className="space-y-2">
            {docs.map((d) => (
              <a
                key={d.id}
                href={attachmentHref(d)}
                target="_blank"
                rel="noopener noreferrer"
                className="glass flex items-center gap-3 rounded-xl px-4 py-3 hover:border-moss/40"
              >
                <FileText className="size-5 shrink-0 text-moss" />
                <span className="min-w-0 flex-1 truncate text-sm text-forest">
                  {d.filename}
                </span>
                <Download className="size-4 shrink-0 text-muted" />
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p
        className={
          strong
            ? "mt-0.5 font-display text-lg text-success"
            : "mt-0.5 font-display text-lg text-forest"
        }
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-body">{value}</span>
    </div>
  );
}
