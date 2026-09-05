import { db } from "@/lib/db";
import { computeCycle, urgencyScore } from "@/lib/cycle";
import type { RoundRow } from "@/components/round-board";
import { activityKinds, kindFilter } from "@/lib/activity-kinds";
import { activityPlotIds, plotFilter } from "@/lib/activity-plots";

/**
 * Where every plot sits in its 45-day picking round, most pressing first.
 * Pass a clientId to scope it to one grower; omit it for Jinto's whole book.
 */
export async function getRoundBoard(clientId?: string): Promise<RoundRow[]> {
  const CYCLE_TYPES = ["HARVEST", "FERTILIZER", "SPRAYING"];

  const [plots, activities] = await Promise.all([
    db.plot.findMany({
      where: { isActive: true, ...(clientId ? { clientId } : {}) },
      select: {
        id: true,
        name: true,
        clientId: true,
        client: { select: { name: true, isActive: true } },
      },
    }),
    /*
     * Fetched once and grouped here rather than read through each plot's
     * foreign key.
     *
     * The key only knows a visit's *primary* block. A spray round that covered
     * two blocks would count for one of them and leave the other looking
     * untouched — so this board, which is how Jinto decides where to go next,
     * would send him back to a block he worked yesterday and let a genuinely
     * overdue one sit.
     *
     * Grouping in JS also keeps the 45-day window exact. Merging two capped
     * per-plot lists would silently drop the older half of a busy block's
     * history, and the cycle is computed from gaps between dates.
     */
    db.activity.findMany({
      where: {
        // Either the primary kind or an extra one. A visit logged as
        // "fertilizer, and picked while we were there" has HARVEST only in its
        // extras, and matching on `type` alone would leave it out of the
        // picking cycle entirely.
        OR: [
          { type: { in: CYCLE_TYPES } },
          { extraKinds: { some: { key: { in: CYCLE_TYPES } } } },
        ],
        ...(clientId ? { clientId } : {}),
      },
      orderBy: { date: "desc" },
      select: {
        type: true,
        date: true,
        plotId: true,
        extraPlots: { select: { plotId: true } },
        extraKinds: { select: { key: true } },
      },
    }),
  ]);

  /*
   * Expanded twice over: once per block the visit covered, once per kind of
   * work it recorded.
   *
   * computeCycle takes a flat list of {type, date} and looks for HARVEST among
   * them. Handing it only the primary kind hides a harvest that was logged as
   * the second thing done on a walk — the board would then say "no harvest
   * logged yet" for a block picked that morning.
   */
  const byPlot = new Map<string, { type: string; date: Date }[]>();
  for (const a of activities) {
    const kinds = activityKinds(a).filter((k) => CYCLE_TYPES.includes(k));
    for (const plotId of activityPlotIds(a)) {
      const list = byPlot.get(plotId) ?? [];
      for (const type of kinds) list.push({ type, date: a.date });
      byPlot.set(plotId, list);
    }
  }

  return plots
    .filter((p) => p.client.isActive)
    .map((p) => ({
      plotId: p.id,
      plotName: p.name,
      clientId: p.clientId,
      clientName: p.client.name,
      cycle: computeCycle(byPlot.get(p.id) ?? []),
    }))
    .sort((a, b) => urgencyScore(b.cycle) - urgencyScore(a.cycle));
}

/**
 * Every read here takes clientId as its first argument and scopes on it.
 * Callers pass the value from the session, never from the request.
 */

export async function getClientOverview(clientId: string) {
  const [client, plots, activityCount, recent, harvests, spend] =
    await Promise.all([
      db.client.findUnique({ where: { id: clientId } }),
      db.plot.findMany({
        where: { clientId, isActive: true },
        orderBy: { createdAt: "asc" },
      }),
      db.activity.count({ where: { clientId } }),
      db.activity.findMany({
        where: { clientId },
        orderBy: { date: "desc" },
        take: 5,
        include: {
          attachments: { where: { kind: "IMAGE" }, take: 3 },
          extraKinds: { select: { key: true } },
          extraPlots: { select: { plot: { select: { id: true, name: true } } } },
          plot: { select: { name: true } },
          _count: { select: { attachments: true, materials: true } },
        },
      }),
      db.activity.findMany({
        where: { clientId, type: "HARVEST" },
        orderBy: { date: "desc" },
      }),
      db.activity.aggregate({
        where: { clientId },
        _sum: { totalCost: true, labourCost: true, materialCost: true },
      }),
    ]);

  const driedTotal = harvests.reduce((s, h) => s + (h.driedWeightKg ?? 0), 0);
  const saleTotal = harvests.reduce((s, h) => s + (h.saleAmount ?? 0), 0);

  return {
    client,
    plots,
    activityCount,
    recent,
    harvests,
    driedTotal,
    saleTotal,
    spend: {
      total: spend._sum.totalCost ?? 0,
      labour: spend._sum.labourCost ?? 0,
      material: spend._sum.materialCost ?? 0,
    },
  };
}

export async function getActivities(
  clientId: string,
  filters?: { type?: string; plotId?: string },
) {
  return db.activity.findMany({
    where: {
      clientId,
      // Both places, or the filter quietly lies: a visit whose primary kind is
      // Fertilizer but which also covered weeding must appear under Weeding.
      ...(filters?.type ? kindFilter(filters.type) : {}),
      ...(filters?.plotId ? plotFilter(filters.plotId) : {}),
    },
    orderBy: { date: "desc" },
    include: {
      plot: { select: { name: true } },
      attachments: { where: { kind: "IMAGE" }, take: 3 },
      extraKinds: { select: { key: true } },
      extraPlots: { select: { plot: { select: { id: true, name: true } } } },
      _count: { select: { attachments: true, materials: true } },
    },
  });
}

/** Returns null rather than throwing when the record isn't the caller's. */
export async function getActivityForClient(clientId: string, id: string) {
  const activity = await db.activity.findFirst({
    where: { id, clientId },
    include: {
      plot: true,
      materials: { include: { extraCategories: { select: { key: true } } } },
      extraKinds: { select: { key: true } },
      extraPlots: { select: { plot: { select: { id: true, name: true } } } },
      grades: { orderBy: { driedKg: "desc" } },
      attachments: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { name: true } },
      workers: { include: { worker: { select: { name: true, role: true } } } },
    },
  });
  return activity;
}

export async function getMedia(clientId: string, kind: "IMAGE" | "VIDEO") {
  return db.attachment.findMany({
    where: { clientId, kind },
    orderBy: { createdAt: "desc" },
    include: { activity: { select: { id: true, title: true, date: true } } },
  });
}

export async function getDocuments(clientId: string) {
  return db.attachment.findMany({
    where: { clientId, kind: "DOCUMENT" },
    orderBy: { createdAt: "desc" },
    include: { activity: { select: { id: true, title: true } } },
  });
}

/** Spend grouped by calendar month, newest first. */
export async function getSpendByMonth(clientId: string) {
  const activities = await db.activity.findMany({
    where: { clientId },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      type: true,
      title: true,
      labourCost: true,
      materialCost: true,
      otherCost: true,
      totalCost: true,
      saleAmount: true,
    },
  });

  const buckets = new Map<
    string,
    {
      key: string;
      date: Date;
      labour: number;
      material: number;
      other: number;
      total: number;
      income: number;
      items: typeof activities;
    }
  >();

  for (const a of activities) {
    const key = `${a.date.getFullYear()}-${a.date.getMonth()}`;
    const bucket = buckets.get(key) ?? {
      key,
      date: new Date(a.date.getFullYear(), a.date.getMonth(), 1),
      labour: 0,
      material: 0,
      other: 0,
      total: 0,
      income: 0,
      items: [] as typeof activities,
    };
    bucket.labour += a.labourCost ?? 0;
    bucket.material += a.materialCost ?? 0;
    bucket.other += a.otherCost ?? 0;
    bucket.total += a.totalCost ?? 0;
    bucket.income += a.saleAmount ?? 0;
    bucket.items.push(a);
    buckets.set(key, bucket);
  }

  return [...buckets.values()].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
}

/** Every input applied, newest first — the traceability view. */
export async function getInputLog(clientId: string) {
  return db.material.findMany({
    where: { activity: { clientId } },
    orderBy: { activity: { date: "desc" } },
    include: {
      extraCategories: { select: { key: true } },
      activity: {
        select: {
          id: true,
          date: true,
          title: true,
          type: true,
          plot: { select: { name: true } },
        },
      },
    },
  });
}

export async function getMessages(clientId: string) {
  return db.message.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { name: true, role: true } } },
  });
}
