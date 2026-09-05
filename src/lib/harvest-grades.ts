/**
 * The lots a picking was graded into.
 *
 * The other "extras" tables in this project hold labels, and the parent keeps
 * its own primary. Grades are different: they carry weights and money, so the
 * parent's totals are *derived* from the lots rather than sitting beside them.
 *
 *   Activity.driedWeightKg  = the sum of the lots
 *   Activity.saleAmount     = the sum of the lots' sale amounts
 *   Activity.grade          = the heaviest lot
 *   Activity.ratePerKg      = the weighted average rate
 *
 * That is what keeps every existing reader correct without touching it: the
 * season totals, the grower's dashboard, the data export and the reports all
 * read those four fields and go on meaning exactly what they meant before. What
 * changes is that the grade *breakdown* can now attribute each kilogram to the
 * lot it actually came from, instead of putting a whole picking under whichever
 * single grade was chosen.
 *
 * Derived, not duplicated, is the important part. There is one source of truth
 * for how much was picked — the lots — and the totals are computed from it, so
 * they cannot drift apart.
 */

export type GradeLot = {
  grade: string;
  driedKg: number;
  ratePerKg?: number | null;
  saleAmount?: number | null;
};

export type WithGrades = {
  grade: string | null;
  driedWeightKg: number | null;
  saleAmount?: number | null;
  grades?: GradeLot[] | null;
};

/** What one lot is worth. Null rate means "not priced yet", not zero. */
export function lotValue(lot: GradeLot): number | null {
  if (lot.ratePerKg == null) return lot.saleAmount ?? null;
  return lot.driedKg * lot.ratePerKg;
}

/**
 * The totals a picking's lots come to.
 *
 * Returns nulls rather than zeros for an empty list: a harvest with no lots
 * recorded has an unknown weight, and zero would quietly enter the season total
 * as a real figure.
 */
export function totalsFromLots(lots: GradeLot[]): {
  driedWeightKg: number | null;
  saleAmount: number | null;
  grade: string | null;
  ratePerKg: number | null;
} {
  const real = lots.filter((l) => l.grade && Number.isFinite(l.driedKg) && l.driedKg > 0);
  if (real.length === 0) {
    return { driedWeightKg: null, saleAmount: null, grade: null, ratePerKg: null };
  }

  const driedWeightKg = real.reduce((sum, l) => sum + l.driedKg, 0);

  // Only the priced lots contribute to the money. A picking half sold and half
  // still in the curing house should report what it actually fetched, not a
  // total that treats the unpriced half as free.
  const priced = real.filter((l) => lotValue(l) != null);
  const saleAmount = priced.length
    ? priced.reduce((sum, l) => sum + (lotValue(l) ?? 0), 0)
    : null;

  // The heaviest lot, which is what "the grade this round made" means in
  // conversation and what the single-grade badge has always shown.
  const heaviest = real.reduce((a, b) => (b.driedKg > a.driedKg ? b : a));

  // Weighted by the priced weight, not by lot count: two kilos of extra bold
  // and eighty of superior is not an average of the two rates.
  const pricedKg = priced.reduce((sum, l) => sum + l.driedKg, 0);
  const ratePerKg =
    saleAmount != null && pricedKg > 0 ? saleAmount / pricedKg : null;

  return { driedWeightKg, saleAmount, grade: heaviest.grade, ratePerKg };
}

/**
 * How a picking's weight and value break down by grade.
 *
 * Falls back to the activity's own single grade when no lots are recorded —
 * every harvest logged before this existed, and any logged without grading.
 * Without the fallback the season's grade report would lose its whole history
 * the day this shipped.
 */
export function gradeBreakdown(
  activity: WithGrades,
): { grade: string; kg: number; value: number }[] {
  const lots = activity.grades ?? [];
  if (lots.length > 0) {
    return lots.map((l) => ({
      grade: l.grade,
      kg: l.driedKg,
      value: lotValue(l) ?? 0,
    }));
  }
  if (!activity.driedWeightKg) return [];
  return [
    {
      grade: activity.grade ?? "Ungraded",
      kg: activity.driedWeightKg,
      value: activity.saleAmount ?? 0,
    },
  ];
}

/** Every grade named on a picking, heaviest first. */
export function gradeLabels(activity: WithGrades): string[] {
  return gradeBreakdown(activity)
    .sort((a, b) => b.kg - a.kg)
    .map((g) => g.grade);
}
