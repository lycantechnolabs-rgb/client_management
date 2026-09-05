import { cache } from "react";
import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { en, type StringKey } from "./en";
import { ml } from "./ml";

/**
 * Which language the portal speaks, and the words it uses.
 *
 * Three layers, most specific first:
 *
 *   1. what Jinto has corrected, in the database
 *   2. the shipped draft for that language, in ml.ts
 *   3. English
 *
 * The fallback chain is the important part. A key with no Malayalam — one added
 * this week, or one Jinto has not reached yet — shows in English rather than
 * blank. A grower reading a mostly-Malayalam screen with two English labels can
 * still use it; one with two empty labels cannot.
 */

export const LOCALES = ["en", "ml"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ml: "മലയാളം",
};

export const LOCALE_COOKIE = "aela.lang";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/**
 * The reader's language.
 *
 * The account wins over the cookie, because the account is what follows a
 * grower to a second phone or through a cleared browser — and a grower who
 * reads only Malayalam being dropped back into English by a new device is
 * exactly the failure this feature exists to prevent. The cookie is what makes
 * the choice work before signing in, and on the sign-in page itself.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  /*
   * Read from the row rather than the session token.
   *
   * The session carries only what authorisation needs, and adding a display
   * preference to it would mean a grower who changes language keeps the old one
   * until their token refreshes. One extra query, collapsed by cache(), for a
   * choice that takes effect on the next paint.
   */
  const user = await getCurrentUser().catch(() => null);
  if (user) {
    const row = await db.user
      .findUnique({ where: { id: user.id }, select: { locale: true } })
      .catch(() => null);
    if (row && isLocale(row.locale)) return row.locale;
  }

  const jar = await cookies();
  const fromCookie = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(fromCookie) ? fromCookie : "en";
});

/**
 * Jinto's corrections, from the database.
 *
 * One query per request, collapsed by cache(). Falls back to the shipped draft
 * if the table is unreachable — a language that fails to load should degrade to
 * slightly-wrong words, not to a broken page.
 */
const overrides = cache(async (locale: Locale): Promise<Record<string, string>> => {
  if (locale === "en") return {};
  try {
    const rows = await db.translation.findMany({
      where: { locale },
      select: { key: true, value: true },
    });
    return Object.fromEntries(
      rows.filter((r) => r.value.trim() !== "").map((r) => [r.key, r.value]),
    );
  } catch {
    return {};
  }
});

/**
 * Look up a string, optionally filling in placeholders.
 *
 * Interpolation rather than concatenation, because word order is not shared
 * between languages: "Next picking in 25 days" puts the number in the middle
 * and Malayalam does not. Building the sentence from pieces in the caller would
 * hard-code English grammar into every language.
 */
export type Translator = (
  key: StringKey,
  vars?: Record<string, string | number>,
) => string;

function fill(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/**
 * The translator for this request.
 *
 * Typed on StringKey, so asking for a string that does not exist is a compile
 * error rather than a key rendered raw onto a grower's screen.
 */
export const getT = cache(async (): Promise<Translator> => {
  const locale = await getLocale();
  if (locale === "en") return (key, vars) => fill(en[key], vars);

  const fixed = await overrides(locale);
  const draft = ml;

  return (key, vars) => fill(fixed[key] ?? draft[key] ?? en[key], vars);
});

/**
 * English, with no request behind it.
 *
 * For text built outside a render — notification bodies, logs, anything read by
 * Jinto rather than shown to a grower. `getT()` needs cookies and a session;
 * this needs nothing, which is what a background job has.
 */
export const englishT: Translator = (key, vars) => fill(en[key], vars);

/** Both at once, for a page that needs to know which language it is in. */
export const getI18n = cache(async () => {
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  return { locale, t };
});

/**
 * How much of the draft has been checked — for the admin screen only.
 *
 * "Reviewed" means Jinto has looked at the string and either corrected it or
 * confirmed it, both of which write a row. An untouched string is a draft
 * nobody has read.
 */
export async function reviewProgress(locale: Locale) {
  const total = Object.keys(en).length;
  if (locale === "en") return { total, reviewed: total };
  const reviewed = await db.translation.count({
    where: { locale, reviewed: true },
  });
  return { total, reviewed };
}
