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
import { activityLabel } from "@/lib/constants";
import { dayMonth, money, monthLabel } from "@/lib/utils";

export const metadata = { title: "Money" };

export default async function ExpensesPage() {
  const user = await requireClient();
  const months = await getSpendByMonth(user.clientId);

  if (months.length === 0) {
    return (
      <EmptyState
        title="No spending recorded yet"
        description="Everything spent on your estate will be itemised here, month by month."
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
        <StatTile tone="forest" label="Total spent" value={money(totalSpend)} />
        <StatTile label="Labour" value={money(totalLabour)} />
        <StatTile label="Inputs & materials" value={money(totalMaterial)} />
        <StatTile
          label="Sale value"
          value={money(totalIncome)}
          sub="from harvests"
        />
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg text-forest">Month by month</h2>
        <div className="space-y-4">
          {months.map((m) => (
            <Card key={m.key}>
              <CardBody>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-base text-forest">
                    {monthLabel(m.date)}
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
                  <Legend color="bg-forest" label="Labour" value={money(m.labour)} />
                  <Legend color="bg-moss" label="Materials" value={money(m.material)} />
                  {m.other > 0 ? (
                    <Legend color="bg-sage" label="Other" value={money(m.other)} />
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
                        className="flex items-baseline justify-between gap-3 text-sm hover:text-forest"
                      >
                        <span className="min-w-0">
                          <span className="text-muted">
                            {dayMonth(item.date)}
                          </span>{" "}
                          <span className="text-body">{item.title}</span>
                          <span className="ms-1.5 text-xs text-muted">
                            {activityLabel(item.type)}
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
