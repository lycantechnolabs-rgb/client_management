import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, MapPin, User } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { attachmentHref } from "@/lib/files";
import { Badge, Card, CardBody, Divider, SectionHeading } from "@/components/ui";
import { VideoPlayer } from "@/components/video-player";
import { ACTIVITY_TYPES, DOCUMENT_CATEGORIES, activityLabel } from "@/lib/constants";
import { kg, money, shortDate } from "@/lib/utils";
import { activityKinds, hasKind } from "@/lib/activity-kinds";
import { materialCategoryLabels } from "@/lib/material-categories";
import { humanTranslationsFor } from "@/lib/translate/human";
import { TranslatePanel } from "./translate-panel";
import { AddDocumentForm } from "./add-document-form";

export default async function AdminActivityDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const activity = await db.activity.findUnique({
    where: { id },
    include: {
      client: true,
      plot: true,
      materials: { include: { extraCategories: { select: { key: true } } } },
      extraKinds: { select: { key: true } },
      extraPlots: { select: { plot: { select: { id: true, name: true } } } },
      grades: { orderBy: { driedKg: "desc" } },
      attachments: true,
      createdBy: { select: { name: true } },
      workers: { include: { worker: { select: { name: true, role: true } } } },
    },
  });

  if (!activity) notFound();

  const plotNames = [
    ...(activity.plot?.name ? [activity.plot.name] : []),
    ...activity.extraPlots.map((p) => p.plot.name),
  ];

  // What Jinto has already typed for this entry, if anything.
  const stored = await humanTranslationsFor(
    [activity.title, activity.notes],
    "ml",
  );

  const images = activity.attachments.filter((a) => a.kind === "IMAGE");
  const videos = activity.attachments.filter((a) => a.kind === "VIDEO");
  const docs = activity.attachments.filter((a) => a.kind === "DOCUMENT");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/admin/activities"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-forest"
      >
        <ArrowLeft className="size-4" /> Work log
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
              {activityLabel(key)}
            </Badge>
          ))}
        </div>
        <h1 className="mt-2 font-display text-2xl leading-tight text-forest">
          {activity.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <time>{shortDate(activity.date)}</time>
          <Link
            href={`/admin/clients/${activity.clientId}`}
            className="inline-flex items-center gap-1 hover:text-forest"
          >
            <User className="size-3.5" />
            {activity.client.name}
          </Link>
          {plotNames.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {plotNames.join(", ")}
            </span>
          ) : null}
        </div>
      </header>

      {activity.notes ? (
        <Card>
          <CardBody>
            <p className="whitespace-pre-line leading-relaxed text-body">
              {activity.notes}
            </p>
            <p className="mt-3 text-xs text-muted">
              Logged by {activity.createdBy.name}
              {activity.weather ? ` · ${activity.weather}` : ""}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {images.length > 0 ? (
        <section>
          <SectionHeading title={`Photos (${images.length})`} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {images.map((img) => (
              <div
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
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {videos.length > 0 ? (
        <section>
          <SectionHeading title={`Videos (${videos.length})`} />
          <div className="grid gap-3 sm:grid-cols-2">
            {videos.map((v) => (
              <VideoPlayer key={v.id} src={attachmentHref(v)} caption={v.caption} />
            ))}
          </div>
        </section>
      ) : null}

      {hasKind(activity, "HARVEST") ? (
        <Card>
          <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Green" value={kg(activity.greenWeightKg)} />
            <Stat label="Dried" value={kg(activity.driedWeightKg)} />
            <Stat label="Rate" value={money(activity.ratePerKg)} />
            <Stat label="Sale value" value={money(activity.saleAmount)} />
            {/*
              The lots, not one grade. A round split across grades has a weight
              and a price for each, and collapsing that to the heaviest one
              hides what the picking actually made.
            */}
            {activity.grades.length > 0 ? (
              <ul className="col-span-2 space-y-1 text-sm text-body sm:col-span-4">
                {activity.grades.map((g) => (
                  <li key={g.id} className="flex flex-wrap justify-between gap-2">
                    <strong className="font-medium text-forest">{g.grade}</strong>
                    <span>
                      {kg(g.driedKg)}
                      {g.ratePerKg != null ? ` at ${money(g.ratePerKg)}/kg` : ""}
                      {g.saleAmount != null ? ` · ${money(g.saleAmount)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : activity.grade ? (
              <p className="col-span-2 text-sm text-body sm:col-span-4">
                Grade: <strong className="text-forest">{activity.grade}</strong>
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {activity.materials.length > 0 ? (
        <section>
          <SectionHeading title="Inputs applied" />
          <Card>
            <CardBody className="p-0 sm:p-0">
              {activity.materials.map((m, i) => (
                <div key={m.id}>
                  {i > 0 ? <Divider /> : null}
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-forest">
                        {m.name}
                      </p>
                      <p className="text-xs text-muted">
                        {materialCategoryLabels(m).join(" · ").toLowerCase()}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <p className="text-body">
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

      {activity.workers.length > 0 ? (
        <Card>
          <CardBody className="flex flex-wrap gap-2">
            {activity.workers.map((aw) => (
              <span
                key={aw.id}
                className="rounded-full bg-tint px-3 py-1.5 text-sm text-forest"
              >
                {aw.worker.name}
              </span>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="space-y-2.5">
          <SectionHeading title="Cost" />
          <Row label="Labour" value={money(activity.labourCost)} />
          <Row label="Materials" value={money(activity.materialCost)} />
          {activity.otherCost ? (
            <Row label="Other" value={money(activity.otherCost)} />
          ) : null}
          <Divider className="my-1" />
          <div className="flex items-center justify-between">
            <span className="font-medium text-forest">Total</span>
            <span className="font-display text-xl text-forest">
              {money(activity.totalCost)}
            </span>
          </div>
        </CardBody>
      </Card>

      <section>
        <SectionHeading title="Documents" />
        {docs.length > 0 ? (
          <div className="space-y-2">
            {docs.map((d) => (
              <a
                key={d.id}
                href={attachmentHref(d)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 hover:border-moss/40"
              >
                <FileText className="size-5 shrink-0 text-moss" />
                <span className="min-w-0 flex-1 truncate text-sm text-forest">
                  {d.filename}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {DOCUMENT_CATEGORIES.find((c) => c.key === d.category)?.label ??
                    "Other"}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-sm text-muted">
            No bills, invoices or other documents added to this entry yet.
          </p>
        )}
        <div className="mt-3">
          <AddDocumentForm activityId={activity.id} />
        </div>
      </section>

      <section>
        <SectionHeading title="For Malayalam readers" />
        <TranslatePanel
          activityId={activity.id}
          title={activity.title}
          notes={activity.notes}
          titleMl={stored.get(activity.title.trim()) ?? ""}
          notesMl={stored.get((activity.notes ?? "").trim()) ?? ""}
        />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 font-display text-lg text-forest">{value}</p>
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
