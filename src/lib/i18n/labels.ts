import type { StringKey } from "./en";
import type { Translator } from "./index";

/**
 * Catalogue keys, read in the reader's language.
 *
 * `constants.ts` stays the canonical list — the keys, the icons, the tones, the
 * order — and these turn one of its keys into a word. Keeping the English
 * `label` there as well is deliberate: it is what the database column means,
 * what a CSV export writes, and what a developer reads. This is only about how
 * the same key is spoken to whoever is looking.
 *
 * An unknown key falls through to itself rather than throwing. Categories are
 * stored as strings, and a row written before a key existed should render as
 * its raw key rather than take the page down.
 */

function lookup(t: Translator, prefix: string, key: string): string {
  const full = `${prefix}.${key}` as StringKey;
  const value = t(full);
  // t() returns the key's English when a key is missing from a language, but a
  // key missing from *every* catalogue comes back as undefined — guard for the
  // row written before someone added the type.
  return value ?? key;
}

export const activityLabelIn = (t: Translator, key: string) =>
  lookup(t, "activityType", key);

export const materialCategoryIn = (t: Translator, key: string) =>
  lookup(t, "materialCategory", key);

export const docCategoryIn = (t: Translator, key: string) =>
  lookup(t, "docCategory", key);
