import { db } from "@/lib/db";

/**
 * The inputs Jinto actually reaches for, ordered by how often he uses them.
 *
 * Read from what has already been logged rather than kept as a hard-coded list.
 * A fixed list starts out wrong for this estate and drifts further every season;
 * this one is right by construction and needs no maintenance — a new product
 * appears in the suggestions the second time it is used.
 *
 * The unit and category come from the most recent entry for that name, so
 * tapping a chip fills in what was true last time rather than a default that
 * has to be corrected.
 */

export type CommonMaterial = {
  name: string;
  category: string;
  unit: string;
  /** How many times it has been logged — used only for ordering. */
  uses: number;
};

export async function commonMaterials(limit = 12): Promise<CommonMaterial[]> {
  const rows = await db.material.findMany({
    orderBy: { id: "desc" },
    select: {
      name: true,
      category: true,
      unit: true,
    },
    // Bounded: this is a suggestion list, not a report, and reading every
    // material ever logged to build twelve chips would get slower every season.
    take: 500,
  });

  const seen = new Map<string, CommonMaterial>();
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    // Case-insensitive: "Urea" and "urea" are the same sack.
    const key = name.toLowerCase();
    const existing = seen.get(key);
    if (existing) {
      existing.uses += 1;
    } else {
      // First seen wins for unit and category because the rows arrive newest
      // first — so a chip reflects how the input was logged most recently, not
      // how it was logged years ago.
      seen.set(key, { name, category: row.category, unit: row.unit, uses: 1 });
    }
  }

  return [...seen.values()]
    .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name))
    .slice(0, limit);
}
