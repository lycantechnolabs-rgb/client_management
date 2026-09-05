"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import {
  CONTENT_FIELDS,
  contentField,
  validateContent,
} from "@/lib/site-content";

export type ContentState = {
  error?: string;
  saved?: number;
  message?: string;
};

/**
 * Save the edited fields.
 *
 * Two rules worth stating, because both are the difference between this being
 * safe and being a way to deface the site:
 *
 * **Only catalogued keys are written.** The form's field names are not trusted
 * as keys — each is looked up in the catalogue and anything unrecognised is
 * ignored. Otherwise a crafted post could write arbitrary rows into the shared
 * `Setting` table, which other parts of the app may later read for other
 * purposes entirely.
 *
 * **Every value is validated before any value is written.** A partial save is
 * the worst outcome here: the operator sees an error, assumes nothing happened,
 * and the site is left half-changed. So validation runs over the whole form
 * first and the writes go in one transaction.
 */
export async function saveContent(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  const user = await requireAdmin();

  const edits: { key: string; value: string }[] = [];

  for (const field of CONTENT_FIELDS) {
    const raw = formData.get(field.key);
    // Absent means "not on this form", which is not the same as "cleared".
    if (raw === null) continue;

    const value = String(raw).trim();
    const problem = validateContent(field, value);
    if (problem) return { error: problem };

    edits.push({ key: field.key, value });
  }

  if (edits.length === 0) return { error: "Nothing to save." };

  // Only what actually differs, so the audit log records real changes rather
  // than every time the form was opened and submitted.
  const existing = await db.setting.findMany({
    where: { key: { in: edits.map((e) => e.key) } },
    select: { key: true, value: true },
  });
  const before = new Map(existing.map((r) => [r.key, r.value]));

  const changed = edits.filter((e) => {
    const previous = before.get(e.key) ?? contentField(e.key)?.fallback ?? "";
    return previous !== e.value;
  });

  if (changed.length === 0) {
    return { saved: 0, message: "Nothing had changed." };
  }

  await db.$transaction([
    ...changed.map((e) =>
      db.setting.upsert({
        where: { key: e.key },
        create: { key: e.key, value: e.value },
        update: { value: e.value },
      }),
    ),
    db.auditLog.create({
      data: {
        userId: user.id,
        action: "CONTENT_UPDATED",
        entity: "Setting",
        // The keys, not the values: an audit trail of the public site's copy
        // would grow without bound and is recoverable from the site itself.
        meta: JSON.stringify({ keys: changed.map((c) => c.key) }),
      },
    }),
  ]);

  // Everything that renders any of this. The public pages are cached, so
  // without these a change would not appear until something else evicted them.
  revalidatePath("/", "layout");
  revalidatePath("/admin/content");

  return {
    saved: changed.length,
    message:
      changed.length === 1
        ? "Saved. The site is updated."
        : `Saved ${changed.length} changes. The site is updated.`,
  };
}

/** Put one field back to what the code ships with. */
export async function resetContent(key: string): Promise<ContentState> {
  const user = await requireAdmin();

  const field = contentField(key);
  if (!field) return { error: "Unknown field." };

  await db.setting.deleteMany({ where: { key } });
  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "CONTENT_RESET",
      entity: "Setting",
      meta: JSON.stringify({ key }),
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/content");

  return { saved: 1, message: `${field.label} is back to the original.` };
}
