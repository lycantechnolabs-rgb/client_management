import { createHash } from "node:crypto";

import { db } from "@/lib/db";

/**
 * Malayalam typed by a person, not a machine.
 *
 * Jinto reads and writes Malayalam. When he writes a note in English he can
 * write it again in Malayalam in the same breath, and that costs nothing, sends
 * nothing abroad, and is better than any API would manage on an estate note
 * full of local words for local work.
 *
 * It shares the ContentTranslation table and the hashing with the machine
 * cache on purpose, so the reader needs to know nothing about where a
 * translation came from. The chain falls out of that by itself:
 *
 *   what Jinto typed  →  what the provider returned  →  the English
 *
 * His wording wins because it is already in the table when the machine looks,
 * so the machine never asks about that sentence — no call, no charge, no
 * chance of overwriting him.
 *
 * The catch, and it is a real one: the key is a hash of the English. Edit the
 * English and his Malayalam is orphaned, because the portal has no way to know
 * whether the new sentence still means the same thing. The admin form shows him
 * what is currently stored so an edit is visibly an edit, and the retention
 * sweep clears the orphan later.
 */

const MAX_TEXT_LENGTH = 4000;

/**
 * The same key the machine cache uses.
 *
 * Duplicated from ./index rather than exported from it, because that one is
 * private to the caching logic and this one is a deliberate contract between
 * the two layers — if they ever need to differ, they should be able to.
 * They must not differ by accident, so the audit asserts they agree.
 */
export function translationKey(text: string, target: string) {
  return createHash("sha256")
    .update(`${target} ${text}`)
    .digest("hex")
    .slice(0, 40);
}

/** What is currently stored for this English, if anything. */
export async function humanTranslationsFor(
  texts: (string | null | undefined)[],
  target: string,
): Promise<Map<string, string>> {
  const sources = texts.map((t) => (t ?? "").trim()).filter(Boolean);
  if (sources.length === 0) return new Map();

  const byHash = new Map(sources.map((s) => [translationKey(s, target), s]));
  const rows = await db.contentTranslation.findMany({
    where: { hash: { in: [...byHash.keys()] }, provider: "human" },
    select: { hash: true, value: true },
  });

  const out = new Map<string, string>();
  for (const row of rows) {
    const source = byHash.get(row.hash);
    if (source) out.set(source, row.value);
  }
  return out;
}

/**
 * Store, replace, or clear one hand-written translation.
 *
 * An empty `value` deletes the row rather than storing a blank — that is how
 * Jinto takes a translation back, and a stored empty string would render as a
 * blank title on the grower's phone, which is worse than English.
 */
export async function saveHumanTranslation(
  source: string | null | undefined,
  value: string | null | undefined,
  target: string,
) {
  const text = (source ?? "").trim();
  const translated = (value ?? "").trim();
  if (!text || text.length > MAX_TEXT_LENGTH) return;

  const hash = translationKey(text, target);

  if (!translated) {
    // Only ever removes a hand-written row. A machine translation for the same
    // sentence is a separate thing and not Jinto's to delete by leaving a box
    // empty — he may simply not have filled it in.
    await db.contentTranslation
      .deleteMany({ where: { hash, provider: "human" } })
      .catch(() => {});
    return;
  }

  await db.contentTranslation.upsert({
    where: { hash },
    // Overwrites a machine translation deliberately: a person who has taken the
    // trouble to type this is a better source than the API, and leaving the
    // machine's version in place would make his correction do nothing.
    update: { value: translated, provider: "human", locale: target },
    create: {
      hash,
      locale: target,
      source: text.slice(0, MAX_TEXT_LENGTH),
      value: translated,
      provider: "human",
    },
  });
}

/**
 * The title and notes of one activity, saved together.
 *
 * Takes the English alongside the Malayalam because the English is the key —
 * saving a translation without knowing which sentence it belongs to is not
 * possible here, and that is the point of the design rather than a limitation.
 */
export async function saveActivityTranslations(
  english: { title: string; notes: string | null },
  malayalam: { title: string | null; notes: string | null },
) {
  await Promise.all([
    saveHumanTranslation(english.title, malayalam.title, "ml"),
    saveHumanTranslation(english.notes, malayalam.notes, "ml"),
  ]);
}
