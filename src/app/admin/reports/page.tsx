import Link from "next/link";
import { Download } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { buildReport, PERIODS, periodLabel } from "@/lib/reports";
import {
  Badge,
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  StatTile,
} from "@/components/ui";
import { cn, kg, money, shortDate } from "@/lib/utils";

export const metadata = { title: "Reports" };

/** A labelled proportion bar — used for spend splits and work counts. */
function Bar({
  label,
  value,
  total,
  right,
}: {
  label: string;
  value: number;
  total: number;
  right: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-body">{label}</span>
        <span className="shrink-0 text-forest">{right}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line-soft">
        <div
          className="h-full rounded-full bg-moss"
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const { period } = await searchParams;
  const key = PERIODS.some((p) => p.key === period) ? period! : "12m";

  const report = await buildReport(key);
  const { money: m, harvest, work, inputs, clients, store } = report;

  const spendTotal = m.labour + m.inputs + m.other || m.spend;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl text-forest lg:hidden">Reports</h1>
        <p className="mt-1 text-sm text-body lg:mt-0">
          What the estates cost, what they returned, and where the money went.
        </p>
      </div>

      {/* Period picker. Links rather than a control, so a report is a URL that
          can be sent to the accountant as-is. */}
      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/admin/reports?period=${p.key}`}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm transition-colors",
                p.key === key
                  ? "border-forest bg-forest text-cream"
                  : "border-line bg-surface text-body hover:border-moss/40",
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {report.jobs === 0 ? (
        <EmptyState
          title={`No work recorded in ${periodLabel(key).toLowerCase()}`}
          description="Pick a longer period, or log some work first."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              tone="forest"
              label="Spent on estates"
              value={money(m.spend)}
              sub={`${report.jobs} jobs · ${report.labourDays} labour days`}
            />
            <StatTile
              label="Harvest sale value"
              value={money(m.saleValue)}
              sub={kg(harvest.driedKg) + " dried"}
            />
            <StatTile
              label="Curing recovery"
              value={
                harvest.recovery === null
                  ? "—"
                  : `${harvest.recovery.toFixed(1)}%`
              }
              sub={
                harvest.greenKg > 0
                  ? `${kg(harvest.greenKg)} green in`
                  : "no green weights logged"
              }
            />
            <StatTile
              label="Store revenue"
              value={money(m.storeRevenue)}
              sub={`${store.count} order${store.count === 1 ? "" : "s"}`}
            />
          </div>

          {harvest.recovery !== null &&
          (harvest.recovery < 16 || harvest.recovery > 24) ? (
            <Card className="border-warning/40 bg-warning/8">
              <CardBody className="text-sm text-body">
                <span className="font-medium text-warning">
                  Recovery looks off.
                </span>{" "}
                Cured cardamom usually comes back at about a fifth of its green
                weight. {harvest.recovery.toFixed(1)}% is far enough from that
                to be worth checking — either the curing, or how the weights are
                being written down.
              </CardBody>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardBody>
                <CardTitle>Where the money went</CardTitle>
                <ul className="mt-2 divide-y divide-line-soft">
                  <Bar
                    label="Labour"
                    value={m.labour}
                    total={spendTotal}
                    right={money(m.labour)}
                  />
                  <Bar
                    label="Inputs"
                    value={m.inputs}
                    total={spendTotal}
                    right={money(m.inputs)}
                  />
                  <Bar
                    label="Other"
                    value={m.other}
                    total={spendTotal}
                    right={money(m.other)}
                  />
                </ul>
                {inputs.byCategory.length > 0 ? (
                  <>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      Inputs by kind
                    </p>
                    <ul className="mt-1 divide-y divide-line-soft">
                      {inputs.byCategory.map((c) => (
                        <Bar
                          key={c.key}
                          label={c.label}
                          value={c.cost}
                          total={m.inputs}
                          right={money(c.cost)}
                        />
                      ))}
                    </ul>
                  </>
                ) : null}
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <CardTitle>Work done</CardTitle>
                <ul className="mt-2 divide-y divide-line-soft">
                  {work.map((w) => (
                    <Bar
                      key={w.type}
                      label={w.label}
                      value={w.count}
                      total={report.jobs}
                      right={`${w.count} · ${money(w.cost)}`}
                    />
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>

          {harvest.byGrade.length > 0 ? (
            <Card>
              <CardBody>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <CardTitle>Harvest by grade</CardTitle>
                  {harvest.avgRate ? (
                    <span className="text-sm text-muted">
                      averaging {money(harvest.avgRate)}/kg
                    </span>
                  ) : null}
                </div>
                <ul className="mt-2 divide-y divide-line-soft">
                  {harvest.byGrade.map(([grade, v]) => (
                    <Bar
                      key={grade}
                      label={grade}
                      value={v.kg}
                      total={harvest.driedKg}
                      right={`${kg(v.kg)} · ${money(v.value)}`}
                    />
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardBody>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>By client</CardTitle>
                {/* The one thing an accountant asks for. */}
                <a
                  href={`/api/reports/clients.csv?period=${key}`}
                  download
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-forest/25 px-4 text-sm text-forest hover:bg-tint"
                >
                  <Download className="size-4" /> CSV
                </a>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[38rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th className="py-2 pr-3 font-medium text-forest">
                        Client
                      </th>
                      <th className="py-2 pr-3 text-right font-medium text-forest">
                        Jobs
                      </th>
                      <th className="py-2 pr-3 text-right font-medium text-forest">
                        Spend
                      </th>
                      <th className="py-2 pr-3 text-right font-medium text-forest">
                        Dried
                      </th>
                      <th className="py-2 pr-3 text-right font-medium text-forest">
                        Sale value
                      </th>
                      <th className="py-2 font-medium text-forest">
                        Last visit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => (
                      <tr key={c.id} className="border-b border-line-soft">
                        <td className="py-2.5 pr-3">
                          <Link
                            href={`/admin/clients/${c.id}`}
                            // The row is already 41px tall; the link was only
                            // as tall as its text. Padding it out uses height
                            // that was there anyway.
                            className="inline-block py-2 text-body hover:text-forest hover:underline"
                          >
                            {c.name}
                          </Link>
                          <span className="ms-1.5 text-xs text-muted">
                            {c.code}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-body">
                          {c.jobs}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-body">
                          {money(c.spend)}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-body">
                          {c.driedKg > 0 ? kg(c.driedKg) : "—"}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-body">
                          {c.saleValue > 0 ? money(c.saleValue) : "—"}
                        </td>
                        <td className="py-2.5 whitespace-nowrap text-muted">
                          {c.lastVisit ? shortDate(c.lastVisit) : "no visits"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {inputs.top.length > 0 ? (
            <Card>
              <CardBody>
                <CardTitle>Most-used inputs</CardTitle>
                <ul className="mt-2 divide-y divide-line-soft">
                  {inputs.top.map(([name, v]) => (
                    <li
                      key={name}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0 truncate text-body">{name}</span>
                      <span className="shrink-0 text-muted">
                        {v.quantity.toFixed(0)} {v.unit} ·{" "}
                        <span className="text-forest">{money(v.cost)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {store.count > 0 ? (
            <Card>
              <CardBody>
                <CardTitle>Store</CardTitle>
                <div className="mt-2 flex flex-wrap gap-2">
                  {store.byStatus.map(([status, count]) => (
                    <Badge key={status} tone="muted">
                      {count} {status.toLowerCase()}
                    </Badge>
                  ))}
                </div>
                <ul className="mt-3 divide-y divide-line-soft">
                  {store.topProducts.map(([name, v]) => (
                    <Bar
                      key={name}
                      label={name}
                      value={v.value}
                      total={m.storeRevenue}
                      right={`${v.qty} sold · ${money(v.value)}`}
                    />
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
