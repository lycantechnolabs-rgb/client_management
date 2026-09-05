import { cache } from "react";

import { db } from "@/lib/db";
import { CONTENT_DEFAULTS, CONTENT_FIELDS } from "@/lib/site-content";

/**
 * The live text of the public site.
 *
 * One query per request, collapsed by React's `cache()` — the header, the hero
 * and the footer all want the business name, and none of them should each cost
 * a round trip.
 *
 * Defaults are merged *under* the stored rows, never the other way round. A
 * key that has never been edited, or a row that was deleted, falls back to what
 * the code ships with. The consequence worth stating: this function cannot
 * return a blank heading, so no amount of odd data in the settings table can
 * leave the home page looking broken.
 *
 * The `Setting` table already existed and was seeded with four rows that
 * nothing read. This is what it was for.
 */
export const getContent = cache(async (): Promise<Record<string, string>> => {
  const keys = CONTENT_FIELDS.map((f) => f.key);

  let rows: { key: string; value: string }[] = [];
  try {
    rows = await db.setting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });
  } catch {
    // The public pages are the ones a customer sees first. If the settings
    // table is unreachable they should render on the shipped defaults rather
    // than fail — nothing here is load-bearing enough to justify an error page.
    return { ...CONTENT_DEFAULTS };
  }

  const stored = Object.fromEntries(
    rows
      // A row whose value is empty is not an edit, it is an absence. Only the
      // fields marked optional are allowed to render as nothing.
      .filter((r) => r.value.trim() !== "")
      .map((r) => [r.key, r.value]),
  );

  return { ...CONTENT_DEFAULTS, ...stored };
});

/** One value, for a page that needs a single field. */
export async function content(key: string): Promise<string> {
  return (await getContent())[key] ?? "";
}
