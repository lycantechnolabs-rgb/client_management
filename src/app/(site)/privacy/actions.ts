"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  NOTICE_VERSION,
  REQUEST_KINDS,
  makeReference,
  responseDueDate,
} from "@/lib/dpdp";
import {
  NOTIFICATION_KINDS,
  adminRecipient,
  queueNotification,
} from "@/lib/notify";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type RequestState = {
  error?: string;
  reference?: string;
  dueBy?: string;
};

const kinds = REQUEST_KINDS.map((k) => k.key) as [string, ...string[]];

const schema = z.object({
  name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email — we reply to this address"),
  phone: z.string().optional(),
  kind: z.enum(kinds, { message: "Choose what you would like us to do" }),
  details: z.string().optional(),
});

/**
 * A Data Principal exercising a right, from the public side of the site.
 *
 * Two deliberate decisions here.
 *
 * We do not verify identity before *accepting* the request, only before
 * acting on it. Making someone prove who they are in order to file a
 * complaint about how their data is handled is a good way to ensure nobody
 * ever files one, and the Act does not require it. Verification happens in the
 * admin, where Jinto rings the number back before releasing or erasing
 * anything — recorded in the response.
 *
 * We also never answer "no such person here". Whether an email is in our
 * records is itself personal data, so an unknown address gets the same
 * reference and the same wait as a known one.
 */
export async function submitDataRequest(
  _prev: RequestState,
  formData: FormData,
): Promise<RequestState> {
  const ip = clientIp(await headers());

  // Filing a right is free and must stay easy, so this is loose — it is here
  // to stop a script filling the queue, not to make a person try twice.
  const limit = await rateLimit(`dpdp:req:${ip}`, 10, 60 * 60_000);
  if (!limit.allowed) {
    return {
      error:
        "That is a lot of requests from one place. Please call us instead — the number is on the privacy page.",
    };
  }

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const data = parsed.data;
  const email = data.email.trim().toLowerCase();

  // If this email belongs to a grower, tie the request to them so the admin
  // opens it with the account already in hand. A store customer has no
  // account, and the null is correct rather than a gap.
  const client = await db.client.findFirst({
    where: { users: { some: { email } } },
    select: { id: true },
  });

  const dueBy = responseDueDate();

  const request = await db.dataRequest.create({
    data: {
      reference: makeReference("DPR"),
      subject: email,
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      clientId: client?.id ?? null,
      kind: data.kind,
      details: data.details?.trim() || null,
      dueBy,
    },
  });

  await db.auditLog.create({
    data: {
      action: "DPDP_REQUEST_RECEIVED",
      entity: "DataRequest",
      entityId: request.id,
      meta: JSON.stringify({
        kind: data.kind,
        reference: request.reference,
        noticeVersion: NOTICE_VERSION,
      }),
    },
  });


  // A rights request starts a 30-day clock. Jinto is the only person who can
  // answer it, so the deadline is worth more than a badge he might not see.
  const admin = await adminRecipient();
  if (admin) {
    await queueNotification({
      kind: NOTIFICATION_KINDS.DATA_REQUEST,
      toName: admin.name ?? "Jinto",
      toPhone: admin.phone,
      toEmail: admin.email,
      userId: admin.id,
      body: `Data request ${request.reference} — ${data.kind}.
From ${data.name.trim()}.
Reply due by ${dueBy.toDateString()}.`,
    });
  }

  return {
    reference: request.reference,
    dueBy: dueBy.toISOString(),
  };
}
