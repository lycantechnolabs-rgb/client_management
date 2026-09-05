"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { en, type StringKey } from "@/lib/i18n/en";
import { isLocale } from "@/lib/i18n";

export type ReviewState = { error?: string; message?: string; saved?: number };

/**
 * Record Jinto's reading of the drafts.
 *
 * Two things happen at once, and keeping them together is the point: the words
 * he types become the text growers see, and the act of typing them records that
 * a person has read the string. A separate "mark as checked" button would let
 * the two drift, and the useful question — how much of this has a human
 * actually looked at — would stop having an answer.
 *
 * Confirming a draft unchanged still writes a row. It is not a redundant copy:
 * it is the difference between "nobody has read this" and "a Malayalam speaker
 * read it and it was already right".
 */
export async function saveTranslations(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  await requireAdmin();

  const locale = String(formData.get("locale") ?? "");
  if (!isLocale(locale) || locale === "en") {
    return { error: "That language cannot be edited here." };
  }

  const keys = Object.keys(en) as StringKey[];
  const writes: { key: string; value: string }[] = [];

  for (const key of keys) {
    const raw = formData.get(`s:${key}`);
    // Absent means the key was not on this page of the form, which is not the
    // same as cleared.
    if (raw === null) continue;

    const value = String(raw).trim();
    if (!value) continue;

    // Same rule as the website content: these are rendered as text, and the
    // check exists so pasting markup fails loudly rather than printing angle
    // brackets onto a grower's screen.
    if (/[<>]/.test(value)) {
      return { error: `“${en[key]}” cannot contain < or >.` };
    }
    writes.push({ key, value });
  }

  if (writes.length === 0) return { error: "Nothing to save." };

  await db.$transaction(
    writes.map((w) =>
      db.translation.upsert({
        where: { locale_key: { locale, key: w.key } },
        create: { locale, key: w.key, value: w.value, reviewed: true },
        update: { value: w.value, reviewed: true },
      }),
    ),
  );

  // Every page in the portal carries these words.
  revalidatePath("/", "layout");

  return {
    saved: writes.length,
    message:
      writes.length === 1
        ? "Saved. One more checked."
        : `Saved. ${writes.length} checked.`,
  };
}

/** Drop a correction and go back to the shipped draft. */
export async function resetTranslation(locale: string, key: string) {
  await requireAdmin();
  if (!isLocale(locale) || locale === "en") return { error: "Unknown language." };

  await db.translation.deleteMany({ where: { locale, key } });
  revalidatePath("/", "layout");
  return { ok: true };
}
