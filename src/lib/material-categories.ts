import { MATERIAL_CATEGORIES } from "@/lib/constants";

/**
 * The categories on one material.
 *
 * Same shape as activity-kinds.ts, and for the same reason: a drench can be
 * both a fungicide and a growth promoter, and lime is a soil conditioner that
 * some estates book as fertilizer. Forcing one label makes the grower's input
 * log and Jinto's cost-by-category report quietly wrong — not visibly broken,
 * just describing something that did not happen.
 *
 * `Material.category` stays the primary and every existing reader keeps
 * working; `MaterialCategory` rows hold only the extras. Nothing is stored
 * twice, so nothing can disagree, and this module is the only place that knows
 * the full set is `[category, ...extraCategories]`.
 */

export type WithCategories = {
  category: string;
  extraCategories?: { key: string }[] | null;
};

const ORDER: string[] = MATERIAL_CATEGORIES.map((c) => c.key);

export const categoryLabel = (key: string) =>
  MATERIAL_CATEGORIES.find((c) => c.key === key)?.label ?? key;

/** Every category, primary first, catalogue order after that. */
export function materialCategories(material: WithCategories): string[] {
  const extras = (material.extraCategories ?? []).map((c) => c.key);
  const rest = [...new Set(extras)]
    .filter((k) => k !== material.category)
    .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return [material.category, ...rest];
}

export function materialCategoryLabels(material: WithCategories): string[] {
  return materialCategories(material).map(categoryLabel);
}

/**
 * Split a submitted list into what the database stores.
 *
 * Falls back to OTHER rather than throwing — a material with no category is a
 * validation slip, and losing the row over it would be worse than filing it as
 * "Other".
 */
export function splitCategories(selected: string[]): {
  category: string;
  extras: string[];
} {
  const clean = [...new Set(selected.filter((k) => ORDER.includes(k)))].sort(
    (a, b) => ORDER.indexOf(a) - ORDER.indexOf(b),
  );
  if (clean.length === 0) return { category: "OTHER", extras: [] };
  return { category: clean[0], extras: clean.slice(1) };
}

/**
 * How a material's cost is attributed across its categories.
 *
 * The report groups spend by category. A material in two categories must not be
 * counted twice — that would inflate the total and make the report disagree with
 * the activity's own cost — so the cost is split evenly between them.
 *
 * Even splitting is a choice, not a truth: nothing in the data says how much of
 * a dual-purpose drench was fungicide and how much was growth promoter. It is
 * the only division that cannot be wrong in a particular direction, and the
 * totals still add up, which is the property the report depends on.
 */
export function costShares(
  material: WithCategories & { cost?: number | null },
): { key: string; cost: number }[] {
  const keys = materialCategories(material);
  const each = (material.cost ?? 0) / keys.length;
  return keys.map((key) => ({ key, cost: each }));
}
