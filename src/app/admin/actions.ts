"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hash } from "@node-rs/argon2";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { makeTempPassword } from "@/lib/utils";

export type ActionState = { error?: string; ok?: boolean; message?: string };

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// SVG is deliberately absent: it is an XML document that can carry <script>,
// and anything served from this origin can read the session cookie. Raster
// formats only for uploads.
const ALLOWED = {
  IMAGE: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  VIDEO: ["video/mp4", "video/quicktime", "video/webm"],
  DOCUMENT: ["application/pdf"],
};

/** Extension is chosen by us from the validated type, never from the filename. */
const EXTENSION_FOR_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "application/pdf": ".pdf",
};

/**
 * Demo upload: writes to /public/uploads.
 * In production this becomes a Cloudinary upload with the asset marked
 * private and delivered through a signed, expiring URL — public/ is
 * world-readable and must not hold client documents.
 */
async function saveUpload(file: File) {
  if (file.size === 0) return null;
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name} is larger than 25 MB.`);
  }

  const kind = ALLOWED.IMAGE.includes(file.type)
    ? "IMAGE"
    : ALLOWED.VIDEO.includes(file.type)
      ? "VIDEO"
      : ALLOWED.DOCUMENT.includes(file.type)
        ? "DOCUMENT"
        : null;

  if (!kind) throw new Error(`${file.name} is not an accepted file type.`);

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });

  // The extension is derived from the MIME type we just allow-listed, never
  // from file.name. Taking it from the filename let an uploader save
  // "photo.html" (declaring image/jpeg) into a world-readable directory on
  // this origin — stored XSS, and any script there could read a session.
  const ext = EXTENSION_FOR_TYPE[file.type] ?? ".bin";
  const filename = `${randomUUID()}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes);

  return {
    kind,
    url: `/uploads/${filename}`,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

/* -------------------------------------------------------------------------- */
/* Clients                                                                     */
/* -------------------------------------------------------------------------- */

const clientSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email("Enter a valid email"),
  village: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  plotName: z.string().min(1, "Give the first estate a name"),
  plotLocation: z.string().optional(),
  plotArea: z.string().optional(),
});

export async function createClient(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const data = parsed.data;

  const existing = await db.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });
  if (existing) return { error: "That email already has an account." };

  const count = await db.client.count();
  const code = `CLT-${String(count + 1).padStart(3, "0")}`;
  const tempPassword = makeTempPassword();

  const client = await db.client.create({
    data: {
      code,
      name: data.name,
      phone: data.phone || null,
      whatsapp: data.whatsapp || data.phone || null,
      email: data.email.toLowerCase(),
      village: data.village || null,
      address: data.address || null,
      notes: data.notes || null,
      plots: {
        create: {
          name: data.plotName,
          location: data.plotLocation || null,
          areaAcres: data.plotArea ? Number(data.plotArea) : null,
        },
      },
      users: {
        create: {
          name: data.name,
          email: data.email.toLowerCase(),
          phone: data.phone || null,
          passwordHash: await hash(tempPassword),
          role: "CLIENT",
          // They must change it at first sign-in.
          mustChangePassword: true,
        },
      },
    },
  });

  revalidatePath("/admin/clients");
  // Temp password is passed through the URL only in this demo so it can be
  // shown once. In production, show it in a one-time modal instead.
  redirect(`/admin/clients/${client.id}?created=${encodeURIComponent(tempPassword)}`);
}

export async function resetClientPassword(clientId: string) {
  await requireAdmin();
  const tempPassword = makeTempPassword();

  const user = await db.user.findFirst({ where: { clientId, role: "CLIENT" } });
  if (!user) return { error: "No login found for this client." };

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hash(tempPassword), mustChangePassword: true },
  });

  await db.auditLog.create({
    data: { action: "RESET_PASSWORD", entity: "User", entityId: user.id },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true, message: tempPassword };
}

export async function toggleClientActive(clientId: string, isActive: boolean) {
  await requireAdmin();
  await db.client.update({ where: { id: clientId }, data: { isActive } });
  // Deactivating the login takes effect on the grower's very next request —
  // the jwt callback re-reads isActive every time.
  await db.user.updateMany({ where: { clientId }, data: { isActive } });
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function addPlot(_prev: ActionState, formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Estate name is required." };

  await db.plot.create({
    data: {
      clientId,
      name,
      location: String(formData.get("location") ?? "") || null,
      areaAcres: formData.get("areaAcres")
        ? Number(formData.get("areaAcres"))
        : null,
      plants: formData.get("plants") ? Number(formData.get("plants")) : null,
    },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true };
}

export async function addWorker(_prev: ActionState, formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Worker name is required." };

  await db.worker.create({
    data: {
      clientId,
      plotId: String(formData.get("plotId") ?? "") || null,
      name,
      phone: String(formData.get("phone") ?? "") || null,
      role: String(formData.get("role") ?? "") || null,
      dailyWage: formData.get("dailyWage")
        ? Number(formData.get("dailyWage"))
        : null,
    },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/workers");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Activities — the field-entry path                                           */
/* -------------------------------------------------------------------------- */

export async function createActivity(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const clientId = String(formData.get("clientId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "");

  if (!clientId) return { error: "Choose a client." };
  if (!type) return { error: "Choose the type of work." };
  if (!title) return { error: "Give the work a short title." };

  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) return { error: "That client no longer exists." };

  const num = (key: string) => {
    const raw = formData.get(key);
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const labourCost = num("labourCost") ?? 0;
  const otherCost = num("otherCost") ?? 0;

  // Materials arrive as parallel arrays from the repeatable rows.
  const names = formData.getAll("materialName").map(String);
  const categories = formData.getAll("materialCategory").map(String);
  const quantities = formData.getAll("materialQuantity").map(String);
  const units = formData.getAll("materialUnit").map(String);
  const costs = formData.getAll("materialCost").map(String);

  const materials = names
    .map((name, i) => ({
      name: name.trim(),
      category: categories[i] || "OTHER",
      quantity: Number(quantities[i] || 0),
      unit: units[i] || "kg",
      cost: costs[i] ? Number(costs[i]) : null,
    }))
    .filter((m) => m.name.length > 0);

  const materialCost =
    num("materialCost_total") ??
    materials.reduce((sum, m) => sum + (m.cost ?? 0), 0);

  const dateRaw = String(formData.get("date") ?? "");
  const date = dateRaw ? new Date(dateRaw) : new Date();

  const driedWeightKg = num("driedWeightKg");
  const ratePerKg = num("ratePerKg");

  let saved: Awaited<ReturnType<typeof saveUpload>>[] = [];
  try {
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    saved = await Promise.all(files.map(saveUpload));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed." };
  }

  const activity = await db.activity.create({
    data: {
      clientId,
      plotId: String(formData.get("plotId") ?? "") || null,
      date,
      type,
      title,
      notes: String(formData.get("notes") ?? "") || null,
      weather: String(formData.get("weather") ?? "") || null,
      labourCount: num("labourCount"),
      labourCost,
      materialCost,
      otherCost,
      totalCost: labourCost + materialCost + otherCost,
      greenWeightKg: num("greenWeightKg"),
      driedWeightKg,
      grade: String(formData.get("grade") ?? "") || null,
      ratePerKg,
      saleAmount:
        driedWeightKg && ratePerKg ? driedWeightKg * ratePerKg : null,
      createdById: admin.id,
      materials: materials.length ? { create: materials } : undefined,
      attachments: {
        create: saved
          .filter((f): f is NonNullable<typeof f> => f !== null)
          .map((f) => ({
            clientId,
            kind: f.kind,
            url: f.url,
            filename: f.filename,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
            caption: title,
          })),
      },
    },
  });

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: "CREATE_ACTIVITY",
      entity: "Activity",
      entityId: activity.id,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/activities");
  revalidatePath("/dashboard");
  redirect(`/admin/activities?saved=${activity.id}`);
}

export async function deleteActivity(id: string) {
  const admin = await requireAdmin();

  const activity = await db.activity.findUnique({
    where: { id },
    select: { clientId: true, title: true, date: true },
  });
  if (!activity) return { error: "That entry no longer exists." };

  await db.activity.delete({ where: { id } });

  // The grower may already have seen this. Deleting it changes the record they
  // rely on, so who removed what is written down.
  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: "DELETE_ACTIVITY",
      entity: "Activity",
      entityId: id,
      meta: JSON.stringify({
        title: activity.title,
        date: activity.date,
        clientId: activity.clientId,
      }),
    },
  });

  revalidatePath("/admin/activities");
  revalidatePath(`/admin/clients/${activity.clientId}`);
  return { ok: true };
}

export async function updateActivity(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!id) return { error: "Missing entry." };
  if (!title) return { error: "A title is required." };

  const existing = await db.activity.findUnique({
    where: { id },
    select: { clientId: true },
  });
  if (!existing) return { error: "That entry no longer exists." };

  const num = (k: string) => {
    const v = formData.get(k);
    if (v === null || String(v).trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const labourCost = num("labourCost");
  const materialCost = num("materialCost");
  const otherCost = num("otherCost");

  await db.activity.update({
    where: { id },
    data: {
      title,
      notes: String(formData.get("notes") ?? "") || null,
      date: formData.get("date")
        ? new Date(String(formData.get("date")))
        : undefined,
      plotId: String(formData.get("plotId") ?? "") || null,
      labourCount: num("labourCount"),
      labourCost,
      materialCost,
      otherCost,
      totalCost: (labourCost ?? 0) + (materialCost ?? 0) + (otherCost ?? 0),
      greenWeightKg: num("greenWeightKg"),
      driedWeightKg: num("driedWeightKg"),
      grade: String(formData.get("grade") ?? "") || null,
    },
  });

  revalidatePath(`/admin/activities/${id}`);
  revalidatePath("/admin/activities");
  revalidatePath(`/admin/clients/${existing.clientId}`);
  return { ok: true, message: "Entry updated." };
}

/* -------------------------------------------------------------------------- */
/* Editing and removing client records                                         */
/* -------------------------------------------------------------------------- */

export async function updateClient(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id) return { error: "Missing client." };
  if (!name) return { error: "Name is required." };

  await db.client.update({
    where: { id },
    data: {
      name,
      phone: String(formData.get("phone") ?? "") || null,
      whatsapp: String(formData.get("whatsapp") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      village: String(formData.get("village") ?? "") || null,
      district: String(formData.get("district") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    },
  });

  revalidatePath(`/admin/clients/${id}`);
  revalidatePath("/admin/clients");
  return { ok: true, message: "Client updated." };
}

export async function updatePlot(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id) return { error: "Missing estate." };
  if (!name) return { error: "Estate name is required." };

  const plot = await db.plot.update({
    where: { id },
    data: {
      name,
      location: String(formData.get("location") ?? "") || null,
      areaAcres: formData.get("areaAcres")
        ? Number(formData.get("areaAcres"))
        : null,
      plants: formData.get("plants") ? Number(formData.get("plants")) : null,
      notes: String(formData.get("notes") ?? "") || null,
    },
  });

  revalidatePath(`/admin/clients/${plot.clientId}`);
  return { ok: true, message: "Estate updated." };
}

/**
 * Removing an estate that has work logged against it would strand that history,
 * so it is archived instead. Only an estate with nothing recorded is actually
 * deleted.
 */
export async function removePlot(id: string) {
  const admin = await requireAdmin();

  const plot = await db.plot.findUnique({
    where: { id },
    select: { clientId: true, name: true, _count: { select: { activities: true } } },
  });
  if (!plot) return { error: "That estate no longer exists." };

  const hasHistory = plot._count.activities > 0;

  if (hasHistory) {
    await db.plot.update({ where: { id }, data: { isActive: false } });
  } else {
    await db.plot.delete({ where: { id } });
  }

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: hasHistory ? "ARCHIVE_PLOT" : "DELETE_PLOT",
      entity: "Plot",
      entityId: id,
      meta: JSON.stringify({ name: plot.name, clientId: plot.clientId }),
    },
  });

  revalidatePath(`/admin/clients/${plot.clientId}`);
  return {
    ok: true,
    message: hasHistory
      ? `${plot.name} archived — its work history is kept.`
      : `${plot.name} removed.`,
  };
}

export async function updateWorker(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id) return { error: "Missing worker." };
  if (!name) return { error: "Worker name is required." };

  const worker = await db.worker.update({
    where: { id },
    data: {
      name,
      phone: String(formData.get("phone") ?? "") || null,
      role: String(formData.get("role") ?? "") || null,
      plotId: String(formData.get("plotId") ?? "") || null,
      dailyWage: formData.get("dailyWage")
        ? Number(formData.get("dailyWage"))
        : null,
      notes: String(formData.get("notes") ?? "") || null,
    },
  });

  revalidatePath(`/admin/clients/${worker.clientId}`);
  revalidatePath("/admin/workers");
  return { ok: true, message: "Worker updated." };
}

/**
 * A worker who appears in logged work is archived rather than deleted —
 * destroying the row would quietly rewrite who did the work on days the grower
 * has already seen. Only a worker with no recorded days is truly removed.
 */
export async function removeWorker(id: string) {
  const admin = await requireAdmin();

  const worker = await db.worker.findUnique({
    where: { id },
    select: {
      clientId: true,
      name: true,
      _count: { select: { activityWorkers: true } },
    },
  });
  if (!worker) return { error: "That worker no longer exists." };

  const hasHistory = worker._count.activityWorkers > 0;

  if (hasHistory) {
    await db.worker.update({ where: { id }, data: { isActive: false } });
  } else {
    await db.worker.delete({ where: { id } });
  }

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: hasHistory ? "ARCHIVE_WORKER" : "DELETE_WORKER",
      entity: "Worker",
      entityId: id,
      meta: JSON.stringify({ name: worker.name, clientId: worker.clientId }),
    },
  });

  revalidatePath(`/admin/clients/${worker.clientId}`);
  revalidatePath("/admin/workers");
  return {
    ok: true,
    message: hasHistory
      ? `${worker.name} archived — their recorded days are kept.`
      : `${worker.name} removed.`,
  };
}

/** Restores an archived estate or worker. */
export async function restorePlot(id: string) {
  await requireAdmin();
  const plot = await db.plot.update({
    where: { id },
    data: { isActive: true },
  });
  revalidatePath(`/admin/clients/${plot.clientId}`);
  return { ok: true };
}

export async function restoreWorker(id: string) {
  await requireAdmin();
  const worker = await db.worker.update({
    where: { id },
    data: { isActive: true },
  });
  revalidatePath(`/admin/clients/${worker.clientId}`);
  revalidatePath("/admin/workers");
  return { ok: true };
}

/** Removes a single photo, video or document from a work-log entry. */
export async function removeAttachment(id: string) {
  const admin = await requireAdmin();

  const attachment = await db.attachment.findUnique({
    where: { id },
    select: { clientId: true, activityId: true, filename: true },
  });
  if (!attachment) return { error: "That file no longer exists." };

  await db.attachment.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: "DELETE_ATTACHMENT",
      entity: "Attachment",
      entityId: id,
      meta: JSON.stringify({
        filename: attachment.filename,
        clientId: attachment.clientId,
      }),
    },
  });

  if (attachment.activityId) {
    revalidatePath(`/admin/activities/${attachment.activityId}`);
  }
  revalidatePath(`/admin/clients/${attachment.clientId}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
/* -------------------------------------------------------------------------- */

export async function updateOrderStatus(orderId: string, status: string) {
  await requireAdmin();
  await db.order.update({ where: { id: orderId }, data: { status } });
  revalidatePath("/admin/orders");
}
