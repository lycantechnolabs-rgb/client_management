"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { makeReference, responseDueDate } from "@/lib/dpdp";
import {
  NOTIFICATION_KINDS,
  adminRecipient,
  queueNotification,
} from "@/lib/notify";
import { requireClient } from "@/lib/session";

export type PrivacyState = { error?: string; ok?: boolean; message?: string };

/**
 * Nomination under s.14 — naming someone who may exercise these rights if the
 * grower dies or cannot act for themselves.
 *
 * Written straight to the record rather than queued as a request, because this
 * is the grower editing their own data about their own nominee. Routing it
 * through Jinto would put a third party in the middle of a private choice for
 * no benefit.
 */
export async function saveNomination(
  _prev: PrivacyState,
  formData: FormData,
): Promise<PrivacyState> {
  const { clientId, id: userId } = await requireClient();

  const name = String(formData.get("nomineeName") ?? "").trim();
  const phone = String(formData.get("nomineePhone") ?? "").trim();
  const relation = String(formData.get("nomineeRelation") ?? "").trim();

  if (name && !phone) {
    return { error: "Add a phone number for your nominee so we can reach them." };
  }

  await db.client.update({
    where: { id: clientId },
    data: {
      nomineeName: name || null,
      nomineePhone: phone || null,
      nomineeRelation: relation || null,
    },
  });

  await db.auditLog.create({
    data: {
      userId,
      action: name ? "DPDP_NOMINATION_SET" : "DPDP_NOMINATION_CLEARED",
      entity: "Client",
      entityId: clientId,
    },
  });

  revalidatePath("/dashboard/privacy");
  return {
    ok: true,
    message: name ? "Nominee saved." : "Nominee removed.",
  };
}

/**
 * Correction, erasure or a grievance, raised from inside the portal.
 *
 * Identity is already proved by the session, so unlike the public form there
 * is nothing to verify — the request arrives in the admin queue already tied
 * to the account, and Jinto can act on it without a callback.
 */
export async function raisePortalRequest(
  _prev: PrivacyState,
  formData: FormData,
): Promise<PrivacyState> {
  const user = await requireClient();

  const kind = String(formData.get("kind") ?? "");
  if (!["CORRECTION", "ERASURE", "GRIEVANCE", "ACCESS"].includes(kind)) {
    return { error: "Choose what you would like us to do." };
  }

  const details = String(formData.get("details") ?? "").trim();
  if (!details) {
    return { error: "Tell us a little about what you need." };
  }

  const client = await db.client.findUnique({
    where: { id: user.clientId },
    select: { name: true, phone: true },
  });

  const request = await db.dataRequest.create({
    data: {
      reference: makeReference("DPR"),
      subject: (user.email ?? "").toLowerCase(),
      name: client?.name ?? user.name ?? "Grower",
      phone: client?.phone ?? null,
      clientId: user.clientId,
      kind,
      details,
      dueBy: responseDueDate(),
    },
  });

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "DPDP_REQUEST_RECEIVED",
      entity: "DataRequest",
      entityId: request.id,
      meta: JSON.stringify({ kind, reference: request.reference, via: "PORTAL" }),
    },
  });

  const admin = await adminRecipient();
  if (admin) {
    await queueNotification({
      kind: NOTIFICATION_KINDS.DATA_REQUEST,
      toName: admin.name ?? "Jinto",
      toPhone: admin.phone,
      toEmail: admin.email,
      userId: admin.id,
      clientId: user.clientId,
      body: `Data request ${request.reference} — ${kind}.
From ${client?.name ?? "a grower"} in the portal.
Reply due within 30 days.`,
    });
  }

  revalidatePath("/dashboard/privacy");
  return {
    ok: true,
    message: `Request ${request.reference} received. We will reply within 30 days.`,
  };
}

/**
 * Withdrawing consent, which s.6(6) says must be as easy as giving it.
 *
 * The grant is not edited or deleted — a withdrawal appends a new row. The
 * question the trail has to answer is "what were they told, and what did they
 * agree to, and when did that change", and overwriting the grant would destroy
 * the first two halves of that answer.
 */
export async function withdrawConsent(purpose: string) {
  const user = await requireClient();
  const email = (user.email ?? "").toLowerCase();

  const latest = await db.consentRecord.findFirst({
    where: { subject: email, purpose },
    orderBy: { createdAt: "desc" },
  });

  if (!latest || !latest.granted) {
    return { error: "There is no live permission to withdraw here." };
  }

  await db.consentRecord.create({
    data: {
      subject: email,
      clientId: user.clientId,
      purpose,
      granted: false,
      source: "PORTAL",
      noticeVersion: latest.noticeVersion,
    },
  });

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "DPDP_CONSENT_WITHDRAWN",
      entity: "ConsentRecord",
      meta: JSON.stringify({ purpose }),
    },
  });

  revalidatePath("/dashboard/privacy");
  return { ok: true, message: "Permission withdrawn." };
}
