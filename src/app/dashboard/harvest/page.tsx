import Link from "next/link";
import { requireClient } from "@/lib/session";
import { getClientOverview } from "@/lib/queries";
import { Card, CardBody, EmptyState, StatTile } from "@/components/ui";
import { kg, money, shortDate } from "@/lib/utils";
import { getI18n } from "@/lib/i18n";

export const metadata = { title: "Harvest" };

export default async function HarvestPage() {
  const [user, { locale, t }] = await Promise.all([requireClient(), getI18n()]);
  const { harvests, driedTotal, saleTotal } = await getClientOverview(
    user.clientId,
  );

  if (harvests.length === 0) {
    return (
      <EmptyState
        title={t("harvest.noneYet")}
        description={t("harvest.noneYetBody")}
        variant="glass"
      />
    );
  }

  const greenTotal = harvests.reduce((s, h) => s + (h.greenWeightKg ?? 0), 0);
  const avgRate = saleTotal && driedTotal ? saleTotal / driedTotal : 0;

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile tone="forest" label={t("harvest.driedTotal")} value={kg(driedTotal)} />
        <StatTile tone="glass" label={t("harvest.greenPicked")} value={kg(greenTotal)} />
        <StatTile tone="glass" label={t("harvest.value")} value={money(saleTotal)} />
        <StatTile
          tone="glass"
          label={t("harvest.averageRate")}
          value={money(avgRate)}
          sub={t("harvest.perKgDried")}
        />
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg text-forest">
          {t("harvest.pickingRounds")} ({harvests.length})
        </h2>
        <div className="space-y-3">
          {harvests.map((h) => (
            <Card key={h.id} variant="glass">
              <CardBody>
                <Link
                  href={`/dashboard/activities/${h.id}`}
                  className="block hover:text-forest"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-base text-forest">
                        {h.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted">
                        {shortDate(h.date, locale)}
                        {h.grade ? ` · ${h.grade}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 font-display text-lg text-success">
                      {money(h.saleAmount)}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-3 gap-3 rounded-xl bg-tint/50 p-3">
                    <div>
                      <dt className="text-[11px] text-muted">{t("harvest.green")}</dt>
                      <dd className="text-sm font-medium text-forest">
                        {kg(h.greenWeightKg)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted">{t("harvest.driedLabel")}</dt>
                      <dd className="text-sm font-medium text-forest">
                        {kg(h.driedWeightKg)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted">{t("harvest.rateLabel")}</dt>
                      <dd className="text-sm font-medium text-forest">
                        {money(h.ratePerKg)}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
