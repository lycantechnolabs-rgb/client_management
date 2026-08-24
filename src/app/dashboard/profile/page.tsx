import Link from "next/link";
import { LogOut, MessageCircle, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/session";
import {
  ButtonLink,
  Card,
  CardBody,
  Divider,
  SectionHeading,
} from "@/components/ui";
import { shortDate } from "@/lib/utils";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireClient();
  const client = await db.client.findUnique({
    where: { id: user.clientId },
    include: {
      plots: { where: { isActive: true } },
      workers: { where: { isActive: true } },
    },
  });

  if (!client) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardBody>
          <SectionHeading title="Your details" />
          <dl className="space-y-3 text-sm">
            <Row label="Name" value={client.name} />
            <Row label="Client code" value={client.code} />
            <Row label="Phone" value={client.phone ?? "—"} />
            <Row label="Email" value={client.email ?? "—"} />
            <Row
              label="Address"
              value={
                [client.address, client.village, client.district]
                  .filter(Boolean)
                  .join(", ") || "—"
              }
            />
            <Row label="With us since" value={shortDate(client.createdAt)} />
          </dl>
          <p className="mt-4 text-xs text-muted">
            To change any of these, message Jinto and he&rsquo;ll update them.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionHeading title={`Estates (${client.plots.length})`} />
          <ul className="space-y-3">
            {client.plots.map((p) => (
              <li key={p.id} className="text-sm">
                <p className="font-medium text-forest">{p.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {[
                    p.location,
                    p.areaAcres ? `${p.areaAcres} acres` : null,
                    p.plants ? `${p.plants.toLocaleString("en-IN")} plants` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {client.workers.length > 0 ? (
        <Card>
          <CardBody>
            <SectionHeading title={`Workers (${client.workers.length})`} />
            <ul className="divide-y divide-line-soft">
              {client.workers.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-forest">{w.name}</p>
                    {w.role ? (
                      <p className="text-xs text-muted">{w.role}</p>
                    ) : null}
                  </div>
                  {w.phone ? (
                    <a
                      href={`tel:${w.phone}`}
                      className="shrink-0 text-xs text-moss hover:underline"
                    >
                      {w.phone}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="space-y-3">
          <SectionHeading title="Get in touch" />
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="tel:8590657900" variant="outline">
              <Phone className="size-4" /> Call Jinto
            </ButtonLink>
            <ButtonLink
              href="https://wa.me/918590657900"
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
            >
              <MessageCircle className="size-4" /> WhatsApp
            </ButtonLink>
          </div>
          <Divider className="my-1" />
          <Link
            href="/api/signout"
            className="inline-flex items-center gap-2 text-sm text-danger hover:underline"
          >
            <LogOut className="size-4" /> Sign out
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-body">{value}</dd>
    </div>
  );
}
