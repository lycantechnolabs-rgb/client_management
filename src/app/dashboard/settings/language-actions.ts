"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";

/**
 * Change the reading language.
 *
 * Written to both places on purpose. The cookie makes the change immediate and
 * survives signing out, which is what the sign-in page needs; the account makes
 * it follow the grower to a second phone. A grower who reads only Malayalam
 * being dropped back into English by a new device is the failure this feature
 * exists to prevent, so the choice cannot live only in a browser.
 *
 * Signed out, only the cookie is written — there is no account to write to, and
 * this must still work for someone who has not signed in yet.
 */
export async function setLocale(next: string) {
  if (!isLocale(next)) return { error: "Unknown language." };

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    // Readable by the server only. Nothing in the browser needs it, and a
    // cookie the page can write is a cookie an injected script can write.
    httpOnly: true,
  });

  const user = await getCurrentUser().catch(() => null);
  if (user) {
    await db.user.update({ where: { id: user.id }, data: { locale: next } });
  }

  // Every rendered page carries the language, so the whole tree is stale.
  revalidatePath("/", "layout");
  return { ok: true };
}
