/**
 * The cardamom round.
 *
 * Picking comes back to the same plants roughly every 45 days through the
 * season. Straight after a picking round the plants are fed, and then sprayed
 * against pests — so one round is:
 *
 *     Harvest  →  Fertilizer  →  Pesticide spray  →  (wait ~45 days)  →  Harvest
 *
 * Everything here is derived from the work already logged. Nothing extra has to
 * be entered: if Jinto records a harvest, the next round dates itself.
 */

export const HARVEST_INTERVAL_DAYS = 45;

/** How long after a harvest the feed and the spray are expected. */
export const FERTILIZER_DUE_DAYS = 7;
export const SPRAY_DUE_DAYS = 14;

/** Grace period before a round counts as late rather than simply due. */
const DUE_WINDOW_DAYS = 7;

export type RoundStage = "HARVEST" | "FERTILIZER" | "SPRAYING";

export type RoundStatus =
  | "waiting" // next picking still some way off
  | "due" // in the picking window
  | "overdue" // past the window
  | "no-history"; // nothing logged yet, so nothing to predict

export type CycleActivity = {
  type: string;
  date: Date;
};

export type PlotCycle = {
  status: RoundStatus;
  /** Date of the most recent harvest, if any. */
  lastHarvest: Date | null;
  daysSinceHarvest: number | null;
  /** lastHarvest + 45 days. */
  nextHarvestDue: Date | null;
  /** Negative once overdue. */
  daysUntilNextHarvest: number | null;
  /** Which picking round of the season this last one was. */
  roundNumber: number;
  /** Follow-up work after the most recent harvest. */
  fertilizerDone: boolean;
  sprayDone: boolean;
  /** What should happen next on this plot. */
  nextStep: RoundStage;
  /** True when the follow-up is late. */
  fertilizerOverdue: boolean;
  sprayOverdue: boolean;
};

const DAY_MS = 86_400_000;

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

export function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/**
 * Works out where a plot sits in its round from its logged activities.
 * `activities` may be in any order.
 */
export function computeCycle(
  activities: CycleActivity[],
  now: Date = new Date(),
): PlotCycle {
  const harvests = activities
    .filter((a) => a.type === "HARVEST")
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  if (harvests.length === 0) {
    return {
      status: "no-history",
      lastHarvest: null,
      daysSinceHarvest: null,
      nextHarvestDue: null,
      daysUntilNextHarvest: null,
      roundNumber: 0,
      fertilizerDone: false,
      sprayDone: false,
      nextStep: "HARVEST",
      fertilizerOverdue: false,
      sprayOverdue: false,
    };
  }

  const lastHarvest = harvests[0].date;
  const daysSinceHarvest = daysBetween(lastHarvest, now);
  const nextHarvestDue = addDays(lastHarvest, HARVEST_INTERVAL_DAYS);
  const daysUntilNextHarvest = daysBetween(now, nextHarvestDue);

  // Follow-up counts only if it happened after the latest picking round.
  const since = (type: string) =>
    activities.some(
      (a) => a.type === type && a.date.getTime() >= lastHarvest.getTime(),
    );

  const fertilizerDone = since("FERTILIZER");
  const sprayDone = since("SPRAYING");

  const status: RoundStatus =
    daysUntilNextHarvest > 0
      ? "waiting"
      : daysUntilNextHarvest >= -DUE_WINDOW_DAYS
        ? "due"
        : "overdue";

  const nextStep: RoundStage = !fertilizerDone
    ? "FERTILIZER"
    : !sprayDone
      ? "SPRAYING"
      : "HARVEST";

  return {
    status,
    lastHarvest,
    daysSinceHarvest,
    nextHarvestDue,
    daysUntilNextHarvest,
    roundNumber: harvests.length,
    fertilizerDone,
    sprayDone,
    nextStep,
    fertilizerOverdue:
      !fertilizerDone && daysSinceHarvest > FERTILIZER_DUE_DAYS,
    sprayOverdue: !sprayDone && daysSinceHarvest > SPRAY_DUE_DAYS,
  };
}

/** Sort key: the most pressing plot first. */
export function urgencyScore(c: PlotCycle) {
  if (c.status === "no-history") return -1000;
  let score = -(c.daysUntilNextHarvest ?? 0); // overdue scores highest
  if (c.fertilizerOverdue) score += 30;
  if (c.sprayOverdue) score += 20;
  return score;
}

export function describeCycle(c: PlotCycle): string {
  if (c.status === "no-history") return "No harvest logged yet";
  const d = c.daysUntilNextHarvest ?? 0;
  if (d > 1) return `Next picking in ${d} days`;
  if (d === 1) return "Next picking tomorrow";
  if (d === 0) return "Next picking due today";
  return `Picking ${Math.abs(d)} ${Math.abs(d) === 1 ? "day" : "days"} overdue`;
}
