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
import { getContent } from "@/lib/content";
import { getI18n } from "@/lib/i18n";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { locale, t } = await getI18n();
  const c = await getContent();
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
      <Card variant="glass">
        <CardBody>
          <SectionHeading title={t("profile.title")} />
          <dl className="space-y-3 text-sm">
            <Row label={t("profile.name")} value={client.name} />
            <Row label={t("profile.clientCode")} value={client.code} />
            <Row label={t("profile.phone")} value={client.phone ?? "—"} />
            <Row label={t("profile.email")} value={client.email ?? "—"} />
            <Row
              label={t("profile.address")}
              value={
                [client.address, client.village, client.district]
                  .filter(Boolean)
                  .join(", ") || "—"
              }
            />
            <Row label={t("profile.withUsSince")} value={shortDate(client.createdAt, locale)} />
          </dl>
          <p className="mt-4 text-xs text-muted">
            {t("profile.changeYourselfIn")}{" "}
            <Link
              href="/dashboard/settings"
              className="underline hover:text-forest"
            >
              {t("profile.settingsLink")}
            </Link>
            {t("profile.messageJintoForRest")}
          </p>
        </CardBody>
      </Card>

      <Card variant="glass">
        <CardBody>
          <SectionHeading title={`${t("profile.estates")} (${client.plots.length})`} />
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
        <Card variant="glass">
          <CardBody>
            <SectionHeading title={`${t("profile.workers")} (${client.workers.length})`} />
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
                      className="inline-flex min-h-11 shrink-0 items-center text-xs text-moss hover:underline"
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

      <Card variant="glass">
        <CardBody className="space-y-3">
          <SectionHeading title={t("profile.getInTouch")} />
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`tel:${c.contact_phone}`} variant="outline">
              <Phone className="size-4" /> Call Jinto
            </ButtonLink>
            <ButtonLink
              href={`https://wa.me/${c.whatsapp}`}
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
            className="inline-flex min-h-11 items-center gap-2 text-sm text-danger hover:underline"
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
