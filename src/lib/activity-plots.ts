/**
 * The blocks one visit covered.
 *
 * A round rarely stops at a boundary: Jinto sprays the lower block and the
 * upper one on the same walk. Recorded against a single plot, the other block's
 * 45-day picking cycle is computed as though nothing happened there, and the
 * round board calls it overdue the day after it was worked. That is the failure
 * this exists to prevent — not a cosmetic one, since the round board is what
 * decides where he goes next.
 *
 * Same asymmetric storage as activity-kinds.ts: `Activity.plotId` stays the
 * primary and every existing reader keeps working, `ActivityPlot` rows hold
 * only the extras, and nothing is stored twice.
 */

export type WithPlots = {
  plotId: string | null;
  extraPlots?: { plotId: string }[] | null;
};

/** Every block this visit covered, primary first. Empty when none was named. */
export function activityPlotIds(activity: WithPlots): string[] {
  const extras = (activity.extraPlots ?? []).map((p) => p.plotId);
  const rest = [...new Set(extras)].filter((id) => id !== activity.plotId);
  return activity.plotId ? [activity.plotId, ...rest] : rest;
}

export function coversPlot(activity: WithPlots, plotId: string): boolean {
  return activityPlotIds(activity).includes(plotId);
}

/**
 * Split a submitted list into what the database stores.
 *
 * An activity may legitimately name no plot at all — work on the whole estate,
 * or an office job — so this returns a null primary rather than inventing one.
 */
export function splitPlots(
  selected: string[],
  valid: string[],
): { plotId: string | null; extras: string[] } {
  const order = valid;
  const clean = [...new Set(selected.filter((id) => valid.includes(id)))].sort(
    (a, b) => order.indexOf(a) - order.indexOf(b),
  );
  if (clean.length === 0) return { plotId: null, extras: [] };
  return { plotId: clean[0], extras: clean.slice(1) };
}

/**
 * A Prisma `where` matching activities that touched a given block.
 *
 * Both places, or the filter under-reports: a grower filtering their log by the
 * upper block would not see the spray round that covered it, and would conclude
 * it had been skipped.
 */
export function plotFilter(plotId: string) {
  return {
    OR: [{ plotId }, { extraPlots: { some: { plotId } } }],
  };
}
