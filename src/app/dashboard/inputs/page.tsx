import Link from "next/link";
import { Info } from "lucide-react";
import { requireClient } from "@/lib/session";
import { getInputLog } from "@/lib/queries";
import { Card, CardBody, EmptyState } from "@/components/ui";
import { money, shortDate } from "@/lib/utils";
import { getI18n } from "@/lib/i18n";
import { materialCategoryIn } from "@/lib/i18n/labels";
import { materialCategories } from "@/lib/material-categories";

export const metadata = { title: "Input log" };

/**
 * Every fertilizer, pesticide and fungicide applied, with date and quantity.
 * Buyers and certifiers increasingly ask growers for exactly this record.
 */
export default async function InputsPage() {
  const [{ locale, t }, user] = await Promise.all([getI18n(), requireClient()]);
  const materials = await getInputLog(user.clientId);

  if (materials.length === 0) {
    return (
      <EmptyState
        title={t("inputs.noneYet")}
        description={t("inputs.noneYetBody")}
        variant="glass"
      />
    );
  }

  // Counted under each of its categories: a fungicide that is also a growth
  // promoter belongs in both tallies, and these are counts of uses rather than
  // money, so there is nothing to divide.
  const byCategory = new Map<string, number>();
  for (const m of materials) {
    for (const key of materialCategories(m)) {
      byCategory.set(key, (byCategory.get(key) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-moss/30 bg-tint/40">
        <CardBody className="flex gap-3">
          <Info className="size-5 shrink-0 text-moss" />
          <div>
            <p className="text-sm font-medium text-forest">
              {t("inputs.recordTitle")}
            </p>
            <p className="mt-1 text-sm text-body">
              {t("inputs.recordBody")}
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-wrap gap-2 text-xs text-muted">
        {[...byCategory.entries()].map(([cat, count]) => (
          <span
            key={cat}
            className="rounded-full border border-line bg-surface px-3 py-1.5"
          >
            {materialCategoryIn(t, cat)} · {count}
          </span>
        ))}
      </div>

      <Card variant="glass">
        <CardBody className="p-0 sm:p-0">
          {/* Table on desktop, stacked rows on phones */}
          <div className="hidden lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-medium">{t("table.date")}</th>
                  <th className="px-5 py-3 font-medium">{t("inputs.input")}</th>
                  <th className="px-5 py-3 font-medium">{t("table.type")}</th>
                  <th className="px-5 py-3 font-medium">{t("inputs.quantity")}</th>
                  <th className="px-5 py-3 font-medium">{t("inputs.estate")}</th>
                  <th className="px-5 py-3 text-right font-medium">{t("table.cost")}</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-line-soft last:border-0"
                  >
                    <td className="whitespace-nowrap px-5 py-3 text-muted">
                      {shortDate(m.activity.date, locale)}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/activities/${m.activity.id}`}
                        className="font-medium text-forest hover:underline"
                      >
                        {m.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {materialCategories(m).map((k: string) => materialCategoryIn(t, k)).join(" · ")}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-body">
                      {m.quantity} {m.unit}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {m.activity.plot?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-body">
                      {money(m.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-line-soft lg:hidden">
            {materials.map((m) => (
              <li key={m.id} className="px-4 py-3.5">
                <Link href={`/dashboard/activities/${m.activity.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-forest">
                        {m.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {shortDate(m.activity.date, locale)} ·{" "}
                        {materialCategories(m).map((k: string) => materialCategoryIn(t, k)).join(" · ")}
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
                </Link>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
