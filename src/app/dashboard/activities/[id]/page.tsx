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
import { ACTIVITY_TYPES, activityLabel } from "@/lib/constants";
import { kg, money, shortDate } from "@/lib/utils";

export default async function ActivityDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireClient();
  const { id } = await params;

  // Scoped by clientId — another grower's activity simply doesn't exist here.
  const activity = await getActivityForClient(user.clientId, id);
  if (!activity) notFound();

  const tone =
    ACTIVITY_TYPES.find((t) => t.key === activity.type)?.tone ?? "muted";
  const images = activity.attachments.filter((a) => a.kind === "IMAGE");
  const videos = activity.attachments.filter((a) => a.kind === "VIDEO");
  const docs = activity.attachments.filter((a) => a.kind === "DOCUMENT");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/dashboard/activities"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-forest"
      >
        <ArrowLeft className="size-4" /> All work
      </Link>

      <header>
        <Badge tone={tone as never}>{activityLabel(activity.type)}</Badge>
        <h1 className="mt-2 font-display text-2xl leading-tight text-forest">
          {activity.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <time>{shortDate(activity.date)}</time>
          {activity.plot ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {activity.plot.name}
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
        <Card>
          <CardBody>
            <p className="whitespace-pre-line leading-relaxed text-body">
              {activity.notes}
            </p>
            <p className="mt-3 text-xs text-muted">
              Recorded by {activity.createdBy.name}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {images.length > 0 ? (
        <section>
          <SectionHeading title={`Photos (${images.length})`} />
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
          <SectionHeading title="Video" />
          <div className="space-y-2">
            {videos.map((v) => (
              <VideoPlayer key={v.id} src={attachmentHref(v)} caption={v.caption} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Harvest */}
      {activity.type === "HARVEST" ? (
        <section>
          <SectionHeading title="Harvest record" />
          <Card>
            <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Green weight" value={kg(activity.greenWeightKg)} />
              <Stat label="After curing" value={kg(activity.driedWeightKg)} />
              <Stat label="Rate" value={money(activity.ratePerKg)} />
              <Stat
                label="Sale value"
                value={money(activity.saleAmount)}
                strong
              />
              {activity.grade ? (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-xs text-muted">Grade</p>
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
          <SectionHeading title="What was applied" />
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
                      <p className="mt-0.5 text-xs text-muted">
                        {m.category.toLowerCase()}
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
          <SectionHeading title="Who worked" />
          <Card>
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
          <SectionHeading title="Cost" />
          <Card>
            <CardBody className="space-y-2.5">
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
        </section>
      ) : null}

      {docs.length > 0 ? (
        <section>
          <SectionHeading title="Documents" />
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
