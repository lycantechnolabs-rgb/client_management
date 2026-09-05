import Link from "next/link";
import { Download, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/session";
import { Card, CardBody, CardTitle } from "@/components/ui";
import { GRIEVANCE_OFFICER, RESPONSE_DAYS } from "@/lib/dpdp";
import {
  ConsentCard,
  NominationCard,
  RequestCard,
  type ConsentView,
  type RequestView,
} from "./privacy-panel";

export const metadata = { title: "Your data" };

export default async function DashboardPrivacyPage() {
  const { clientId, email } = await requireClient();

  const [client, counts, consents, requests] = await Promise.all([
    db.client.findUnique({
      where: { id: clientId },
      select: {
        name: true,
        nomineeName: true,
        nomineePhone: true,
        nomineeRelation: true,
      },
    }),
    Promise.all([
      db.plot.count({ where: { clientId } }),
      db.activity.count({ where: { clientId } }),
      db.worker.count({ where: { clientId } }),
      db.attachment.count({ where: { clientId } }),
    ]),
    db.consentRecord.findMany({
      where: { OR: [{ clientId }, { subject: (email ?? "").toLowerCase() }] },
      orderBy: { createdAt: "desc" },
    }),
    db.dataRequest.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const [plots, activities, workers, attachments] = counts;

  const held = [
    { label: "Estates", value: plots },
    { label: "Work entries", value: activities },
    { label: "Workers recorded", value: workers },
    { label: "Photos and documents", value: attachments },
  ];

  const consentView: ConsentView[] = consents.map((c) => ({
    purpose: c.purpose,
    granted: c.granted,
    noticeVersion: c.noticeVersion,
    createdAt: c.createdAt.toISOString(),
  }));

  const requestView: RequestView[] = requests.map((r) => ({
    reference: r.reference,
    kind: r.kind,
    status: r.status,
    details: r.details,
    response: r.response,
    createdAt: r.createdAt.toISOString(),
    dueBy: r.dueBy.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl text-forest lg:hidden">Your data</h1>
        <p className="mt-1 text-sm text-body lg:mt-0">
          What we hold about you, and what you can tell us to do with it.
        </p>
      </div>

      <Card variant="glass">
        <CardBody className="space-y-4">
          <CardTitle>What we hold</CardTitle>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {held.map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-tint/40 px-3 py-3 text-center"
              >
                <dd className="font-display text-2xl text-forest">
                  {item.value}
                </dd>
                <dt className="mt-0.5 text-xs text-muted">{item.label}</dt>
              </div>
            ))}
          </dl>

          <p className="text-sm text-body">
            Your name, phone, email and address are held too, along with the
            costs recorded against your estates.
          </p>

          {/* A plain link, not a fetch: the browser's own download handling is
              more reliable on a phone than anything scripted, and this is the
              one thing on the page a grower is most likely to want offline. */}
          <a
            href="/api/my-data"
            download
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-forest px-5 text-sm font-medium text-cream shadow-card transition-colors hover:bg-forest-600"
          >
            <Download className="size-4" />
            Download a copy of everything
          </a>
        </CardBody>
      </Card>

      <ConsentCard consents={consentView} />

      <NominationCard
        nominee={{
          name: client?.nomineeName ?? null,
          phone: client?.nomineePhone ?? null,
          relation: client?.nomineeRelation ?? null,
        }}
      />

      <RequestCard requests={requestView} />

      <Card className="border-moss/30 bg-tint/25">
        <CardBody className="space-y-2 text-sm">
          <p className="flex items-center gap-2 font-medium text-forest">
            <ShieldCheck className="size-4 text-moss" />
            If we get something wrong
          </p>
          <p className="text-body">
            Speak to {GRIEVANCE_OFFICER.name} on{" "}
            <a
              href={`tel:${GRIEVANCE_OFFICER.phone}`}
              className="underline hover:text-forest"
            >
              {GRIEVANCE_OFFICER.phoneDisplay}
            </a>
            , or raise it above and we will answer within {RESPONSE_DAYS} days.
            If we still have not put it right, you can complain to the Data
            Protection Board of India. The{" "}
            <Link href="/privacy" className="underline hover:text-forest">
              privacy notice
            </Link>{" "}
            has the detail.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
