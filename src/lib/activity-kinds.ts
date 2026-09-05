import { ACTIVITY_TYPES, activityLabel } from "@/lib/constants";

/**
 * The kinds of work recorded against one visit.
 *
 * A round in an estate is rarely one thing: Jinto weeds and applies fertilizer
 * on the same walk. Split across two entries, the grower sees two rows, the
 * costs are divided arbitrarily, and the photographs of one visit end up in two
 * places.
 *
 * The storage is deliberately asymmetric. `Activity.type` is the primary kind
 * and stays exactly what it was, so every existing reader — the badge, the
 * filters, the harvest fields, the reports, the data export — keeps working
 * untouched. `ActivityKind` rows hold only the *extras*. Nothing is stored
 * twice, so nothing can disagree.
 *
 * This module is the only place that knows that, which is the point: everywhere
 * else asks for "the kinds" and gets a straight answer.
 */

export type WithKinds = {
  type: string;
  extraKinds?: { key: string }[] | null;
};

/**
 * Every kind on this activity, primary first, in catalogue order after that.
 *
 * Ordering matters more than it looks — the badges read as a sentence, and a
 * list that reshuffles between renders makes two identical visits look
 * different. Catalogue order is stable and is the order Jinto sees the chips in.
 */
export function activityKinds(activity: WithKinds): string[] {
  const extras = (activity.extraKinds ?? []).map((k) => k.key);
  const order: string[] = ACTIVITY_TYPES.map((t) => t.key);
  const sorted = [...new Set(extras)]
    .filter((k) => k !== activity.type)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return [activity.type, ...sorted];
}

/** Labels for display, e.g. ["Fertilizer", "Weeding"]. */
export function activityKindLabels(activity: WithKinds): string[] {
  return activityKinds(activity).map(activityLabel);
}

/**
 * One line naming all of them: "Fertilizer and weeding", "Fertilizer, weeding
 * and mulching". Used where there is room for a sentence but not for chips.
 */
export function activityKindSentence(activity: WithKinds): string {
  const labels = activityKindLabels(activity);
  if (labels.length === 1) return labels[0];
  const last = labels[labels.length - 1];
  return `${labels.slice(0, -1).join(", ")} and ${last.toLowerCase()}`;
}

/** Does this activity involve a given kind, primary or extra? */
export function hasKind(activity: WithKinds, key: string): boolean {
  return activityKinds(activity).includes(key);
}

/**
 * Split a submitted list into what the database stores.
 *
 * The first selected kind becomes the primary, the rest become extras. Falls
 * back to OTHER rather than throwing: a submission with no kind at all is a
 * validation error the caller should already have caught, and losing the whole
 * entry over it would be worse than filing it as "Other work".
 */
export function splitKinds(selected: string[]): { type: string; extras: string[] } {
  // Widened on purpose: these arrive from a form post and from database rows,
  // so they are strings until checked against the catalogue.
  const valid: string[] = ACTIVITY_TYPES.map((t) => t.key);
  const order = valid;
  const clean = [...new Set(selected.filter((k) => valid.includes(k)))].sort(
    (a, b) => order.indexOf(a) - order.indexOf(b),
  );
  if (clean.length === 0) return { type: "OTHER", extras: [] };
  return { type: clean[0], extras: clean.slice(1) };
}

/**
 * A Prisma `where` that matches an activity by any of its kinds.
 *
 * Filtering has to look in both places or the filter quietly lies: an entry
 * whose primary kind is Fertilizer but which also covered weeding must appear
 * under Weeding, or Jinto will believe no weeding was done that month.
 */
export function kindFilter(key: string) {
  return {
    OR: [{ type: key }, { extraKinds: { some: { key } } }],
  };
}
