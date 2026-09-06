import Link from "next/link";
import { requireClient } from "@/lib/session";
import { getSpendByMonth } from "@/lib/queries";
import {
  Card,
  CardBody,
  Divider,
  EmptyState,
  StatTile,
} from "@/components/ui";
import { dayMonth, money, monthLabel } from "@/lib/utils";
import { getI18n } from "@/lib/i18n";
import { activityLabelIn } from "@/lib/i18n/labels";

export const metadata = { title: "Money" };

export default async function ExpensesPage() {
  const [{ locale, t }, user] = await Promise.all([getI18n(), requireClient()]);
  const months = await getSpendByMonth(user.clientId);

  if (months.length === 0) {
    return (
      <EmptyState
        title={t("money.noneYet")}
        description="Everything spent on your estate will be itemised here, month by month."
        variant="glass"
      />
    );
  }

  const totalSpend = months.reduce((s, m) => s + m.total, 0);
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalLabour = months.reduce((s, m) => s + m.labour, 0);
  const totalMaterial = months.reduce((s, m) => s + m.material, 0);
  const maxMonth = Math.max(...months.map((m) => m.total), 1);

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile tone="forest" label={t("money.totalSpent")} value={money(totalSpend)} />
        <StatTile tone="glass" label={t("money.labour")} value={money(totalLabour)} />
        <StatTile tone="glass" label={t("money.inputsAndMaterials")} value={money(totalMaterial)} />
        <StatTile
          tone="glass"
          label={t("money.income")}
          value={money(totalIncome)}
          sub={t("money.fromHarvests")}
        />
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg text-forest">{t("money.monthByMonth")}</h2>
        <div className="space-y-4">
          {months.map((m) => (
            <Card key={m.key} variant="glass">
              <CardBody>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-base text-forest">
                    {monthLabel(m.date, locale)}
                  </h3>
                  <span className="font-display text-lg text-forest">
                    {money(m.total)}
                  </span>
                </div>

                {/* Simple proportional bar — labour vs materials vs other */}
                <div
                  className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-line-soft"
                  style={{ width: `${Math.max((m.total / maxMonth) * 100, 8)}%` }}
                  role="img"
                  aria-label={`${money(m.labour)} labour, ${money(m.material)} materials`}
                >
                  <div
                    className="bg-forest"
                    style={{ width: `${(m.labour / (m.total || 1)) * 100}%` }}
                  />
                  <div
                    className="bg-moss"
                    style={{ width: `${(m.material / (m.total || 1)) * 100}%` }}
                  />
                  <div
                    className="bg-sage"
                    style={{ width: `${(m.other / (m.total || 1)) * 100}%` }}
                  />
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <Legend color="bg-forest" label={t("money.labour")} value={money(m.labour)} />
                  <Legend color="bg-moss" label={t("money.materials")} value={money(m.material)} />
                  {m.other > 0 ? (
                    <Legend color="bg-sage" label={t("money.other")} value={money(m.other)} />
                  ) : null}
                  {m.income > 0 ? (
                    <span className="ms-auto font-medium text-success">
                      + {money(m.income)} from sales
                    </span>
                  ) : null}
                </div>

                <Divider className="my-3.5" />

                <ul className="space-y-2.5">
                  {m.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/dashboard/activities/${item.id}`}
                        className="flex min-h-11 items-baseline justify-between gap-3 py-1 text-sm hover:text-forest"
                      >
                        <span className="min-w-0">
                          <span className="text-muted">
                            {dayMonth(item.date, locale)}
                          </span>{" "}
                          <span className="text-body">{item.title}</span>
                          <span className="ms-1.5 text-xs text-muted">
                            {activityLabelIn(t, item.type)}
                          </span>
                        </span>
                        <span className="shrink-0 text-body">
                          {money(item.totalCost)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function Legend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${color}`} />
      {label} {value}
    </span>
  );
}
