"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { NOTICE_VERSION, makeReference } from "@/lib/dpdp";
import {
  NOTIFICATION_KINDS,
  adminRecipient,
  queueNotification,
} from "@/lib/notify";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type ContactState = { error?: string; reference?: string };

const TOPICS = ["buying", "wholesale", "estate", "other"] as const;

const schema = z.object({
  name: z.string().min(2, "Enter your name").max(120),
  email: z.string().email("Enter a valid email"),
  phone: z.string().max(20).optional(),
  topic: z.enum(TOPICS, { message: "Choose what this is about" }),
  message: z
    .string()
    .min(10, "Tell us a little more")
    .max(4000, "That is longer than we can take — please summarise"),
});

/**
 * The contact form, which until now displayed "sent successfully" and did
 * nothing at all.
 *
 * Enquiries are stored rather than emailed because there is no mail
 * infrastructure yet. That is the honest half-step: a stored enquiry is one
 * Jinto can answer, whereas the previous behaviour lost it and told the sender
 * it had not. Sending him a WhatsApp or an email when one arrives is the next
 * piece, and nothing here has to change for it.
 *
 * Consent is taken because this is personal data collected for a purpose the
 * sender chooses — see PURPOSES.ENQUIRY in src/lib/dpdp.ts — and the record is
 * written in the same transaction as the enquiry, for the same reason the
 * checkout does it: never hold the details without the evidence we were allowed
 * to.
 */
export async function sendEnquiry(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const ip = clientIp(await headers());

  // A contact form is the most-spammed thing on any site. Loose enough that a
  // person sending a second message about the same thing is never blocked.
  const limit = await rateLimit(`enquiry:${ip}`, 5, 60 * 60_000);
  if (!limit.allowed) {
    return {
      error:
        "That is several messages in a short time. Please ring us instead — the number is just above.",
    };
  }

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  // Re-checked rather than trusted from the `required` attribute: the browser
  // is not where a lawful basis is established.
  if (formData.get("dpdpConsent") !== "yes") {
    return {
      error: "Please confirm you agree to us using your details to reply.",
    };
  }

  const data = parsed.data;
  const email = data.email.trim().toLowerCase();
  const reference = makeReference("ENQ");

  await db.$transaction(async (tx) => {
    await tx.enquiry.create({
      data: {
        reference,
        name: data.name.trim(),
        email,
        phone: data.phone?.trim() || null,
        topic: data.topic,
        message: data.message.trim(),
      },
    });

    await tx.consentRecord.create({
      data: {
        subject: email,
        purpose: "ENQUIRY",
        granted: true,
        source: "CONTACT_FORM",
        noticeVersion: String(formData.get("noticeVersion") ?? NOTICE_VERSION),
      },
    });
  });

  const admin = await adminRecipient();
  if (admin) {
    await queueNotification({
      kind: NOTIFICATION_KINDS.NEW_ENQUIRY,
      toName: admin.name ?? "Jinto",
      toPhone: admin.phone,
      toEmail: admin.email,
      userId: admin.id,
      body: `New enquiry ${reference} — ${data.topic}

${data.name} (${email}${
        data.phone ? `, ${data.phone.trim()}` : ""
      })

${data.message.trim().slice(0, 200)}`,
    });
  }

  revalidatePath("/admin/enquiries");

  return { reference };
}
