import { db } from "@/lib/db";
import { activityLabel, MATERIAL_CATEGORIES } from "@/lib/constants";
import { costShares } from "@/lib/material-categories";
import { gradeBreakdown } from "@/lib/harvest-grades";

/**
 * The numbers behind /admin/reports.
 *
 * Everything here is computed outside any component. The period depends on the
 * clock, and reading the clock while a component renders is the impurity React
 * now rejects — the same reason the privacy dashboard assembles its data here
 * rather than in the page.
 *
 * The admin home already carries the headline figures, so this deliberately
 * goes a level down: not "how much was spent" but what it was spent on, not
 * "how much was dried" but what came back per kilo picked.
 */

export const PERIODS = [
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "12m", label: "Last 12 months", days: 365 },
  { key: "all", label: "Everything", days: null },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

export const periodLabel = (key: string) =>
  PERIODS.find((p) => p.key === key)?.label ?? "Last 12 months";

function rangeFor(key: string) {
  const period = PERIODS.find((p) => p.key === key) ?? PERIODS[1];
  if (period.days === null) return undefined;
  const from = new Date();
  from.setDate(from.getDate() - period.days);
  return from;
}

export type ClientRow = {
  id: string;
  code: string;
  name: string;
  jobs: number;
  spend: number;
  driedKg: number;
  saleValue: number;
  lastVisit: string | null;
};

export async function buildReport(periodKey: string) {
  const from = rangeFor(periodKey);
  const activityWhere = from ? { date: { gte: from } } : {};
  const orderWhere = from ? { createdAt: { gte: from } } : {};

  const [activities, clients, orders, materials, workerDays] =
    await Promise.all([
      db.activity.findMany({
        where: activityWhere,
        select: {
          clientId: true,
          type: true,
          date: true,
          totalCost: true,
          labourCost: true,
          materialCost: true,
          otherCost: true,
          greenWeightKg: true,
          driedWeightKg: true,
          saleAmount: true,
          grade: true,
          grades: { select: { grade: true, driedKg: true, ratePerKg: true, saleAmount: true } },
        },
      }),
      db.client.findMany({
        select: { id: true, code: true, name: true, isActive: true },
        orderBy: { code: "asc" },
      }),
      db.order.findMany({
        where: orderWhere,
        select: {
          status: true,
          total: true,
          items: { select: { productName: true, quantity: true, lineTotal: true } },
        },
      }),
      db.material.findMany({
        where: from ? { activity: { date: { gte: from } } } : {},
        select: {
          name: true,
          category: true,
          cost: true,
          quantity: true,
          unit: true,
          extraCategories: { select: { key: true } },
        },
      }),
      db.activityWorker.aggregate({
        where: from ? { activity: { date: { gte: from } } } : {},
        _sum: { days: true },
      }),
    ]);

  /* ---- money ---- */

  const spend = activities.reduce((s, a) => s + (a.totalCost ?? 0), 0);
  const labour = activities.reduce((s, a) => s + (a.labourCost ?? 0), 0);
  const inputs = activities.reduce((s, a) => s + (a.materialCost ?? 0), 0);
  const other = activities.reduce((s, a) => s + (a.otherCost ?? 0), 0);
  const saleValue = activities.reduce((s, a) => s + (a.saleAmount ?? 0), 0);

  /* ---- harvest ---- */

  const greenKg = activities.reduce((s, a) => s + (a.greenWeightKg ?? 0), 0);
  const driedKg = activities.reduce((s, a) => s + (a.driedWeightKg ?? 0), 0);

  // Dried weight as a share of green. Cardamom loses roughly four fifths of its
  // weight in the curing house, so this sits near 20% — and a number drifting
  // away from that is the earliest sign something is wrong with the curing, or
  // with how the weights are being recorded.
  const recovery = greenKg > 0 ? (driedKg / greenKg) * 100 : null;
  const avgRate = driedKg > 0 ? saleValue / driedKg : null;

  /*
   * Each kilogram under the grade it actually came from.
   *
   * This used to put a whole picking under its single chosen grade, so a round
   * of 40 kg extra bold and 25 of bold reported 65 kg of extra bold. Now the
   * lots supply the split where they exist, and a picking with none falls back
   * to its own grade — which is every harvest logged before this, and any
   * weighed before it was graded.
   */
  const byGrade = new Map<string, { kg: number; value: number }>();
  for (const a of activities) {
    for (const part of gradeBreakdown(a)) {
      const row = byGrade.get(part.grade) ?? { kg: 0, value: 0 };
      row.kg += part.kg;
      row.value += part.value;
      byGrade.set(part.grade, row);
    }
  }

  /* ---- work ---- */

  const byType = new Map<string, { count: number; cost: number }>();
  for (const a of activities) {
    const row = byType.get(a.type) ?? { count: 0, cost: 0 };
    row.count += 1;
    row.cost += a.totalCost ?? 0;
    byType.set(a.type, row);
  }

  /* ---- inputs ---- */

  const byCategory = new Map<string, number>();
  const byMaterial = new Map<string, { cost: number; quantity: number; unit: string }>();
  for (const m of materials) {
    // A material in two categories must not be counted in full under both —
    // that would inflate the total and make this disagree with the activity's
    // own cost. costShares divides it, so the categories still sum correctly.
    for (const share of costShares(m)) {
      byCategory.set(share.key, (byCategory.get(share.key) ?? 0) + share.cost);
    }
    const row = byMaterial.get(m.name) ?? { cost: 0, quantity: 0, unit: m.unit };
    row.cost += m.cost ?? 0;
    row.quantity += m.quantity;
    byMaterial.set(m.name, row);
  }

  /* ---- per client ---- */

  const perClient = new Map<string, ClientRow>();
  for (const c of clients) {
    perClient.set(c.id, {
      id: c.id,
      code: c.code,
      name: c.name,
      jobs: 0,
      spend: 0,
      driedKg: 0,
      saleValue: 0,
      lastVisit: null,
    });
  }
  for (const a of activities) {
    const row = perClient.get(a.clientId);
    if (!row) continue;
    row.jobs += 1;
    row.spend += a.totalCost ?? 0;
    row.driedKg += a.driedWeightKg ?? 0;
    row.saleValue += a.saleAmount ?? 0;
    const iso = a.date.toISOString();
    if (!row.lastVisit || iso > row.lastVisit) row.lastVisit = iso;
  }

  /* ---- store ---- */

  const storeRevenue = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((s, o) => s + o.total, 0);

  const ordersByStatus = new Map<string, number>();
  for (const o of orders) {
    ordersByStatus.set(o.status, (ordersByStatus.get(o.status) ?? 0) + 1);
  }

  const byProduct = new Map<string, { qty: number; value: number }>();
  for (const o of orders) {
    if (o.status === "CANCELLED") continue;
    for (const i of o.items) {
      const row = byProduct.get(i.productName) ?? { qty: 0, value: 0 };
      row.qty += i.quantity;
      row.value += i.lineTotal;
      byProduct.set(i.productName, row);
    }
  }

  const sortDesc = <T,>(m: Map<string, T>, by: (v: T) => number) =>
    [...m.entries()].sort((a, b) => by(b[1]) - by(a[1]));

  return {
    period: periodKey,
    jobs: activities.length,
    money: { spend, labour, inputs, other, saleValue, storeRevenue },
    harvest: {
      greenKg,
      driedKg,
      recovery,
      avgRate,
      byGrade: sortDesc(byGrade, (v) => v.kg),
    },
    work: sortDesc(byType, (v) => v.count).map(([type, v]) => ({
      type,
      label: activityLabel(type),
      ...v,
    })),
    inputs: {
      byCategory: sortDesc(byCategory, (v) => v).map(([key, cost]) => ({
        key,
        label: MATERIAL_CATEGORIES.find((c) => c.key === key)?.label ?? key,
        cost,
      })),
      top: sortDesc(byMaterial, (v) => v.cost).slice(0, 8),
    },
    clients: [...perClient.values()].sort((a, b) => b.spend - a.spend),
    store: {
      count: orders.length,
      byStatus: [...ordersByStatus.entries()],
      topProducts: sortDesc(byProduct, (v) => v.value),
    },
    labourDays: workerDays._sum.days ?? 0,
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;

/**
 * The per-client table as CSV, for whoever does the accounts.
 *
 * Fields are quoted and internal quotes doubled: a grower's name is free text
 * and a stray comma would otherwise shift every column after it.
 */
export function clientsCsv(rows: ClientRow[]) {
  const cell = (v: string | number | null) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;

  const header = [
    "Code",
    "Client",
    "Jobs",
    "Spend (INR)",
    "Dried (kg)",
    "Sale value (INR)",
    "Last visit",
  ];

  const lines = rows.map((r) =>
    [
      r.code,
      r.name,
      r.jobs,
      r.spend.toFixed(2),
      r.driedKg.toFixed(2),
      r.saleValue.toFixed(2),
      r.lastVisit ? r.lastVisit.slice(0, 10) : "",
    ]
      .map(cell)
      .join(","),
  );

  return [header.map(cell).join(","), ...lines].join("\r\n");
}
