"use server";

import { revalidatePath } from "next/cache";
import { hash, verify } from "@node-rs/argon2";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";

export type SettingsState = { error?: string; ok?: boolean; message?: string };

/**
 * Changing your own password.
 *
 * Until now `mustChangePassword` was set when Jinto issued a temporary one and
 * there was nowhere to act on it — the flag was read into the session and never
 * cleared, so a grower handed a temp password had no way to replace it. This is
 * the missing half.
 *
 * The current password is required even though the caller is already signed in.
 * A session is evidence that someone signed in at some point, not that the
 * person at the keyboard right now is the account holder — and an unattended
 * phone is exactly how a grower's account gets taken over.
 */
const schema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(200, "That is too long"),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, {
    message: "The two new passwords do not match",
  });

export async function changePassword(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();

  // Guessing the current password from inside a session is still guessing.
  const ip = clientIp(await headers());
  const limit = await rateLimit(`pwchange:${user.id}:${ip}`, 10, 15 * 60_000);
  if (!limit.allowed) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const { current, next } = parsed.data;

  if (current === next) {
    return { error: "That is the password you already have." };
  }

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row) return { error: "Account not found." };

  const ok = await verify(row.passwordHash, current);
  if (!ok) {
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_CHANGE_FAILED",
        entity: "User",
        entityId: user.id,
      },
    });
    return { error: "That is not your current password." };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hash(next),
      // The whole point of the flag: clearing it here is what makes a
      // temporary password temporary.
      mustChangePassword: false,
    },
  });

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "PASSWORD_CHANGED",
      entity: "User",
      entityId: user.id,
    },
  });

  revalidatePath("/dashboard/settings");

  return {
    ok: true,
    message:
      "Password changed. It takes effect the next time you sign in — you are not signed out here.",
  };
}

/**
 * A grower correcting their own contact details.
 *
 * Doc 06 grants "Edit Own Profile" to clients unconditionally, so this is not
 * permission-gated. The estate records are a different matter and stay with
 * Jinto: what a grower may fix here is how we reach them, not what was done on
 * their land.
 */
/**
 * Email is deliberately absent.
 *
 * The address a grower signs in with lives on User, and the one shown on their
 * client record lives on Client — changing the second would not move the first,
 * so offering it here would quietly do nothing useful. Changing the first is a
 * different matter again: without an email-verification step, self-service
 * email change is an account-takeover path, because whoever changes it becomes
 * the person any future reset is sent to. That goes through Jinto until there
 * is a verification flow to hang it on.
 */
const contactSchema = z.object({
  phone: z.string().max(20).optional(),
  whatsapp: z.string().max(20).optional(),
  address: z.string().max(300).optional(),
});

export async function updateOwnContact(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  if (user.role !== "CLIENT" || !user.clientId) {
    return { error: "Not available for this account." };
  }

  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const data = parsed.data;

  await db.client.update({
    where: { id: user.clientId },
    data: {
      phone: data.phone?.trim() || null,
      whatsapp: data.whatsapp?.trim() || null,
      address: data.address?.trim() || null,
    },
  });

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "CLIENT_UPDATED_OWN_CONTACT",
      entity: "Client",
      entityId: user.clientId,
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/profile");
  revalidatePath(`/admin/clients/${user.clientId}`);

  return { ok: true, message: "Your details are updated." };
}
