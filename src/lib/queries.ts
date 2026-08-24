import { db } from "@/lib/db";
import { computeCycle, urgencyScore } from "@/lib/cycle";
import type { RoundRow } from "@/components/round-board";

/**
 * Where every plot sits in its 45-day picking round, most pressing first.
 * Pass a clientId to scope it to one grower; omit it for Jinto's whole book.
 */
export async function getRoundBoard(clientId?: string): Promise<RoundRow[]> {
  const plots = await db.plot.findMany({
    where: { isActive: true, ...(clientId ? { clientId } : {}) },
    select: {
      id: true,
      name: true,
      clientId: true,
      client: { select: { name: true, isActive: true } },
      activities: {
        where: { type: { in: ["HARVEST", "FERTILIZER", "SPRAYING"] } },
        select: { type: true, date: true },
        orderBy: { date: "desc" },
        take: 40,
      },
    },
  });

  return plots
    .filter((p) => p.client.isActive)
    .map((p) => ({
      plotId: p.id,
      plotName: p.name,
      clientId: p.clientId,
      clientName: p.client.name,
      cycle: computeCycle(p.activities),
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
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.plotId ? { plotId: filters.plotId } : {}),
    },
    orderBy: { date: "desc" },
    include: {
      plot: { select: { name: true } },
      attachments: { where: { kind: "IMAGE" }, take: 3 },
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
      materials: true,
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
