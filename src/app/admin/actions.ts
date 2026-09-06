"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hash } from "@node-rs/argon2";
import { z } from "zod";

import { db } from "@/lib/db";
import { saveActivityTranslations } from "@/lib/translate/human";
import { splitKinds } from "@/lib/activity-kinds";
import { splitCategories } from "@/lib/material-categories";
import { splitPlots } from "@/lib/activity-plots";
import { totalsFromLots } from "@/lib/harvest-grades";
import { CARDAMOM_GRADES } from "@/lib/constants";
import { requireAdmin } from "@/lib/session";
import { BREACH_BOARD_HOURS, makeReference } from "@/lib/dpdp";
import { permissionByKey, roleDefault } from "@/lib/permissions";
import { describePurge, purgeExpiredData } from "@/lib/retention";
import { saveUpload } from "@/lib/uploads";
import { makeTempPassword, slugify } from "@/lib/utils";

export type ActionState = { error?: string; ok?: boolean; message?: string };

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
          // Permanent from the start — Jinto can reset it any time from the
          // client's page, and the grower is never nagged to pick their own.
          mustChangePassword: false,
        },
      },
    },
  });

  revalidatePath("/admin/clients");
  // Temp password is passed through the URL only in this demo so it can be
  // shown once. In production, show it in a one-time modal instead.
  redirect(`/admin/clients/${client.id}?created=${encodeURIComponent(tempPassword)}`);
}

/**
 * Jinto sets a client's login password directly — a permanent one, not a
 * temporary code the grower is then nagged to replace. Growers reach this
 * portal over WhatsApp and a phone call, not a support desk, so "here is your
 * new password" needs to just work from that point on.
 *
 * The grower can still change it themselves from Settings; this simply stops
 * assuming they will, or gating them until they do.
 */
export async function setClientPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < 6) {
    return { error: "Use at least 6 characters." };
  }

  const user = await db.user.findFirst({ where: { clientId, role: "CLIENT" } });
  if (!user) return { error: "No login found for this client." };

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hash(password), mustChangePassword: false },
  });

  await db.auditLog.create({
    data: { action: "SET_CLIENT_PASSWORD", entity: "User", entityId: user.id },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true, message: "Password set." };
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
  // Repeated field: one per chip the admin left switched on. The first becomes
  // the primary kind and the rest become ActivityKind rows — see
  // src/lib/activity-kinds.ts for why the two are stored differently.
  const selectedKinds = formData.getAll("type").map(String).filter(Boolean);
  const { type, extras } = splitKinds(selectedKinds);

  if (!clientId) return { error: "Choose a client." };
  if (selectedKinds.length === 0) return { error: "Choose the type of work." };
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
    .map((name, i) => {
      // One field per row carries every category it was given, joined — so the
      // parallel arrays stay aligned row for row, which a repeated field would
      // not: two categories on row one would shift every later row by one.
      const { category, extras } = splitCategories(
        (categories[i] ?? "").split(",").map((c) => c.trim()),
      );
      return {
        name: name.trim(),
        category,
        extras,
        quantity: Number(quantities[i] || 0),
        unit: units[i] || "kg",
        cost: costs[i] ? Number(costs[i]) : null,
      };
    })
    .filter((m) => m.name.length > 0);

  const materialCost =
    num("materialCost_total") ??
    materials.reduce((sum, m) => sum + (m.cost ?? 0), 0);

  /**
   * Who was on the estate.
   *
   * These ids come from the browser, so they are checked against the database
   * rather than trusted — and specifically against *this client's* workers. A
   * crafted post could otherwise attach one grower's named crew to another
   * grower's visit, which the second grower would then see on their own
   * dashboard: a small cross-tenant leak through a field nobody thinks of as
   * sensitive.
   *
   * Unknown ids are dropped rather than refused. The likely cause is a worker
   * deactivated between the form loading and its submission, and losing the
   * whole entry over that would be worse than filing it without the name.
   */
  /**
   * Which blocks the visit covered.
   *
   * Checked against this client's plots for the same reason the workers are:
   * these ids come from the browser, and an unchecked one would file a visit
   * against another grower's block — visible on their dashboard, and counted
   * in their picking cycle.
   */
  const submittedPlotIds = [...new Set(formData.getAll("plotId").map(String))].filter(Boolean);
  const ownPlots = submittedPlotIds.length
    ? await db.plot.findMany({
        where: { id: { in: submittedPlotIds }, clientId },
        select: { id: true },
      })
    : [];
  const { plotId: primaryPlotId, extras: extraPlotIds } = splitPlots(
    submittedPlotIds,
    ownPlots.map((p) => p.id),
  );

  const submittedWorkerIds = [...new Set(formData.getAll("workerId").map(String))];
  const validWorkers = submittedWorkerIds.length
    ? await db.worker.findMany({
        where: { id: { in: submittedWorkerIds }, clientId, isActive: true },
        select: { id: true, dailyWage: true },
      })
    : [];

  const dateRaw = String(formData.get("date") ?? "");
  const date = dateRaw ? new Date(dateRaw) : new Date();

  /*
   * The graded lots, and the totals derived from them.
   *
   * Derived rather than accepted alongside: the browser sends both the lots and
   * a dried weight, and if the server trusted each independently they could
   * disagree — a round whose lots say 75 kg while its own field says 60. One
   * source of truth, computed here.
   *
   * A round with no lots keeps the old behaviour exactly, so every harvest
   * logged before this, and any weighed before it was graded, still works.
   */
  const gradeNames = formData.getAll("gradeName").map(String);
  const gradeKgs = formData.getAll("gradeDriedKg").map(String);
  const gradeRates = formData.getAll("gradeRate").map(String);

  const validGrades = new Set<string>(CARDAMOM_GRADES);
  const lots = gradeNames
    .map((grade, i) => {
      const driedKg = Number(gradeKgs[i] || 0);
      const rate = gradeRates[i] === "" ? null : Number(gradeRates[i]);
      return {
        grade: grade.trim(),
        driedKg,
        ratePerKg: rate != null && Number.isFinite(rate) ? rate : null,
      };
    })
    .filter(
      (l) =>
        validGrades.has(l.grade) && Number.isFinite(l.driedKg) && l.driedKg > 0,
    )
    // One row per grade. The unique index refuses a duplicate anyway; dropping
    // it here means a double-tap does not lose the whole entry.
    .filter((l, i, all) => all.findIndex((x) => x.grade === l.grade) === i)
    .map((l) => ({
      ...l,
      saleAmount: l.ratePerKg != null ? l.driedKg * l.ratePerKg : null,
    }));

  const fromLots = totalsFromLots(lots);

  const driedWeightKg = fromLots.driedWeightKg ?? num("driedWeightKg");
  const ratePerKg = fromLots.ratePerKg ?? num("ratePerKg");

  let saved: Awaited<ReturnType<typeof saveUpload>>[] = [];
  try {
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    saved = await Promise.all(files.map((file) => saveUpload(file)));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed." };
  }

  const activity = await db.activity.create({
    data: {
      clientId,
      plotId: primaryPlotId,
      extraPlots: extraPlotIds.length
        ? { create: extraPlotIds.map((plotId) => ({ plotId })) }
        : undefined,
      date,
      type,
      extraKinds: extras.length ? { create: extras.map((key) => ({ key })) } : undefined,
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
      // The heaviest lot is "the grade this round made" — what the badge has
      // always shown and what conversation means by it.
      grade: fromLots.grade ?? (String(formData.get("grade") ?? "") || null),
      ratePerKg,
      saleAmount:
        fromLots.saleAmount ??
        (driedWeightKg && ratePerKg ? driedWeightKg * ratePerKg : null),
      grades: lots.length ? { create: lots } : undefined,
      createdById: admin.id,
      workers: validWorkers.length
        ? {
            create: validWorkers.map((w) => ({
              workerId: w.id,
              days: 1,
              // The wage as it stands today, copied onto the row. A rise next
              // season must not silently rewrite what a visit last March cost —
              // the same reason order items keep their own price.
              wage: w.dailyWage,
            })),
          }
        : undefined,
      materials: materials.length
        ? {
            create: materials.map(({ extras, ...m }) => ({
              ...m,
              extraCategories: extras.length
                ? { create: extras.map((key) => ({ key })) }
                : undefined,
            })),
          }
        : undefined,
      attachments: {
        create: saved
          .filter((f): f is NonNullable<typeof f> => f !== null)
          .map((f) => ({
            clientId,
            kind: f.kind,
            url: f.url,
            storageKey: f.storageKey,
            filename: f.filename,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
            caption: title,
          })),
      },
    },
  });

  // The Malayalam Jinto typed, if he typed any. Keyed by the English, so the
  // grower's page finds it without knowing it was written by a person — see
  // src/lib/translate/human.ts.
  await saveActivityTranslations(
    { title: activity.title, notes: activity.notes },
    {
      title: String(formData.get("titleMl") ?? ""),
      notes: String(formData.get("notesMl") ?? ""),
    },
  );

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

/**
 * Adding Malayalam to an entry that already exists.
 *
 * Separate from updateActivity because it changes no estate record at all — it
 * writes a translation of one, and the two want very different permissions and
 * a very different audit line. Nothing about the work done is editable here.
 */
export async function translateActivityByHand(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const activityId = String(formData.get("activityId") ?? "");
  if (!activityId) return { error: "No entry given." };

  // Read the English from the database rather than the form. A hidden field
  // holding the source text would let a stale tab key the translation to
  // wording that has since been edited, and the mismatch would be invisible.
  const activity = await db.activity.findUnique({
    where: { id: activityId },
    select: { id: true, title: true, notes: true, clientId: true },
  });
  if (!activity) return { error: "That entry no longer exists." };

  await saveActivityTranslations(
    { title: activity.title, notes: activity.notes },
    {
      title: String(formData.get("titleMl") ?? ""),
      notes: String(formData.get("notesMl") ?? ""),
    },
  );

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: "TRANSLATE_ACTIVITY",
      entity: "Activity",
      entityId: activity.id,
    },
  });

  revalidatePath(`/admin/activities/${activityId}`);
  // The grower's side is the entire point, so it is revalidated here rather
  // than left to expire — otherwise Jinto saves Malayalam and the grower keeps
  // seeing English until something else happens to bust the cache.
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/activities");
  revalidatePath(`/dashboard/activities/${activityId}`);
  return { ok: true, message: "Saved. Growers on മലയാളം will see this." };
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

  await saveActivityTranslations(
    {
      title,
      notes: String(formData.get("notes") ?? "") || null,
    },
    {
      title: String(formData.get("titleMl") ?? ""),
      notes: String(formData.get("notesMl") ?? ""),
    },
  );

  revalidatePath(`/admin/activities/${id}`);
  revalidatePath("/admin/activities");
  revalidatePath(`/admin/clients/${existing.clientId}`);
  // The grower's pages too — this is the whole point of the edit for a grower
  // reading Malayalam, and without it they keep seeing the old wording.
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/activities/${id}`);
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

/* -------------------------------------------------------------------------- */
/* Store — products, variants and stock                                        */
/* -------------------------------------------------------------------------- */

/**
 * Every write here has to invalidate two audiences: Jinto's admin list and the
 * public store, which renders the same rows. The product page is keyed by slug,
 * and the home page carries the featured strip.
 */
function revalidateStore(slug?: string | null) {
  revalidatePath("/admin/products");
  revalidatePath("/store");
  revalidatePath("/");
  if (slug) revalidatePath(`/store/${slug}`);
}

/**
 * Slugs are the public URL of a product, so they have to be unique. Rather than
 * bounce the form back with "that slug is taken", suffix it.
 */
async function uniqueSlug(desired: string, exceptId?: string) {
  const base = slugify(desired).slice(0, 60) || "product";
  for (let n = 1; ; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const clash = await db.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash || clash.id === exceptId) return candidate;
  }
}

const productSchema = z.object({
  name: z.string().min(2, "Product name is required"),
  slug: z.string().optional(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  grade: z.string().optional(),
  origin: z.string().optional(),
  sortOrder: z.string().optional(),
});

/** The fields shared by creating and updating a product. */
function productFields(
  data: z.infer<typeof productSchema>,
  formData: FormData,
) {
  return {
    name: data.name.trim(),
    shortDescription: data.shortDescription?.trim() || null,
    description: data.description?.trim() || null,
    grade: data.grade?.trim() || null,
    origin: data.origin?.trim() || null,
    isActive: formData.get("isActive") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    sortOrder: data.sortOrder ? Number(data.sortOrder) : 0,
  };
}

type VariantInput = {
  label: string;
  price: number;
  weightGrams: number;
  stock: number;
  compareAt: number | null;
  sku: string | null;
  sortOrder: number;
};

/** Parses one pack off a form. Shared by create, add and update. */
type VariantParse =
  | { ok: false; error: string }
  | { ok: true; value: VariantInput };

function readVariant(formData: FormData): VariantParse {
  const label = String(formData.get("label") ?? "").trim();
  // Number("") is 0, which would quietly price a pack at nothing if the field
  // came through empty. Only a typed figure counts.
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = priceRaw === "" ? NaN : Number(priceRaw);
  const weightGrams = Number(formData.get("weightGrams") ?? NaN);
  const stock = Number(formData.get("stock") ?? 0);
  const compareAtRaw = String(formData.get("compareAt") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();

  if (!label) return { ok: false, error: "Give the pack a label, e.g. 250 g." };
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: "Enter a price of zero or more." };
  }
  if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
    return { ok: false, error: "Enter the pack weight in grams." };
  }
  if (!Number.isFinite(stock) || stock < 0) {
    return { ok: false, error: "Stock cannot be negative." };
  }

  const compareAt = compareAtRaw ? Number(compareAtRaw) : null;
  if (compareAt !== null && (!Number.isFinite(compareAt) || compareAt < 0)) {
    return { ok: false, error: "The struck-through price must be a number." };
  }
  if (compareAt !== null && compareAt <= price) {
    return {
      ok: false,
      error: "The struck-through price has to be above the price.",
    };
  }

  return {
    ok: true,
    value: {
      label,
      price,
      weightGrams: Math.round(weightGrams),
      stock: Math.round(stock),
      compareAt,
      sku: sku || null,
      // Named apart from the product's own sortOrder: the new-product form
      // carries both, and FormData would otherwise hand back the wrong one.
      sortOrder: Number(formData.get("variantSortOrder") ?? 0) || 0,
    },
  };
}

/** A SKU clash is a unique-constraint violation, which reads badly raw. */
async function skuTaken(sku: string | null, exceptId?: string) {
  if (!sku) return false;
  const existing = await db.productVariant.findUnique({
    where: { sku },
    select: { id: true },
  });
  return Boolean(existing && existing.id !== exceptId);
}

export async function createProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  // A product with no pack to buy is not sellable, so the first one is part of
  // creating it rather than a second step.
  const variant = readVariant(formData);
  if (!variant.ok) return { error: variant.error };
  if (await skuTaken(variant.value.sku)) {
    return { error: "That SKU is already used by another pack." };
  }

  const slug = await uniqueSlug(parsed.data.slug || parsed.data.name);

  await db.product.create({
    data: {
      ...productFields(parsed.data, formData),
      slug,
      variants: { create: variant.value },
    },
  });

  revalidateStore(slug);
  redirect("/admin/products");
}

export async function updateProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing product." };

  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const existing = await db.product.findUnique({
    where: { id },
    select: { slug: true },
  });
  if (!existing) return { error: "That product no longer exists." };

  // Renaming does not move the URL on its own. The slug only changes when it is
  // edited directly, so links that are already out there keep working.
  const slug = parsed.data.slug
    ? await uniqueSlug(parsed.data.slug, id)
    : existing.slug;

  await db.product.update({
    where: { id },
    data: { ...productFields(parsed.data, formData), slug },
  });

  revalidateStore(slug);
  if (slug !== existing.slug) revalidatePath(`/store/${existing.slug}`);
  return { ok: true, message: "Product updated." };
}

export async function toggleProductActive(id: string, isActive: boolean) {
  await requireAdmin();
  const product = await db.product.update({
    where: { id },
    data: { isActive },
    select: { slug: true },
  });
  revalidateStore(product.slug);
  return { ok: true };
}

export async function toggleProductFeatured(id: string, isFeatured: boolean) {
  await requireAdmin();
  const product = await db.product.update({
    where: { id },
    data: { isFeatured },
    select: { slug: true },
  });
  revalidateStore(product.slug);
  return { ok: true };
}

/**
 * A product that has been ordered is hidden rather than deleted. Order rows
 * keep their own copy of the name and price, so a customer's record would
 * survive the delete — but the product row is still the only place the
 * description and imagery live, and "delete" here usually means "stop selling".
 */
export async function deleteProduct(id: string) {
  const admin = await requireAdmin();

  const product = await db.product.findUnique({
    where: { id },
    select: {
      slug: true,
      name: true,
      variants: { select: { _count: { select: { orderItems: true } } } },
    },
  });
  if (!product) return { error: "That product no longer exists." };

  const ordered = product.variants.reduce(
    (sum, v) => sum + v._count.orderItems,
    0,
  );

  if (ordered > 0) {
    await db.product.update({ where: { id }, data: { isActive: false } });
  } else {
    await db.product.delete({ where: { id } });
  }

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: ordered > 0 ? "HIDE_PRODUCT" : "DELETE_PRODUCT",
      entity: "Product",
      entityId: id,
      meta: JSON.stringify({ name: product.name, ordered }),
    },
  });

  revalidateStore(product.slug);
  return {
    ok: true,
    message:
      ordered > 0
        ? `${product.name} has been ordered before, so it is hidden from the store rather than deleted.`
        : `${product.name} removed.`,
  };
}

export async function addVariant(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const productId = String(formData.get("productId") ?? "");
  if (!productId) return { error: "Missing product." };

  const variant = readVariant(formData);
  if (!variant.ok) return { error: variant.error };
  if (await skuTaken(variant.value.sku)) {
    return { error: "That SKU is already used by another pack." };
  }

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  if (!product) return { error: "That product no longer exists." };

  await db.productVariant.create({ data: { ...variant.value, productId } });

  revalidateStore(product.slug);
  return { ok: true, message: "Pack added." };
}

export async function updateVariant(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing pack." };

  const variant = readVariant(formData);
  if (!variant.ok) return { error: variant.error };
  if (await skuTaken(variant.value.sku, id)) {
    return { error: "That SKU is already used by another pack." };
  }

  const updated = await db.productVariant.update({
    where: { id },
    data: variant.value,
    select: { product: { select: { slug: true } } },
  });

  revalidateStore(updated.product.slug);
  return { ok: true, message: "Pack updated." };
}

/**
 * The most-used control on this page: Jinto packs six boxes and wants the count
 * to match without opening a form. Clamped at zero, because checkout treats
 * stock as the truth and a negative would let it oversell.
 */
export async function adjustStock(variantId: string, delta: number) {
  await requireAdmin();

  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    select: { stock: true, product: { select: { slug: true } } },
  });
  if (!variant) return { error: "That pack no longer exists." };

  const stock = Math.max(0, variant.stock + Math.round(delta));
  await db.productVariant.update({ where: { id: variantId }, data: { stock } });

  revalidateStore(variant.product.slug);
  return { ok: true };
}

/** Sets stock outright — after a stock count, when +/- would take all day. */
export async function setStock(variantId: string, stock: number) {
  await requireAdmin();
  if (!Number.isFinite(stock) || stock < 0) {
    return { error: "Stock cannot be negative." };
  }

  const variant = await db.productVariant.update({
    where: { id: variantId },
    data: { stock: Math.round(stock) },
    select: { product: { select: { slug: true } } },
  });

  revalidateStore(variant.product.slug);
  return { ok: true };
}

/**
 * Past orders keep their own copy of the pack label and unit price
 * (OrderItem.variantLabel / unitPrice) and the relation is SetNull, so removing
 * a pack cannot rewrite what a customer was charged. The last pack is held
 * back, though — a product with nothing to buy is a dead shop page.
 */
export async function removeVariant(id: string) {
  const admin = await requireAdmin();

  const variant = await db.productVariant.findUnique({
    where: { id },
    select: {
      label: true,
      product: { select: { id: true, slug: true } },
      _count: { select: { orderItems: true } },
    },
  });
  if (!variant) return { error: "That pack no longer exists." };

  const remaining = await db.productVariant.count({
    where: { productId: variant.product.id },
  });
  if (remaining <= 1) {
    return {
      error:
        "This is the only pack. Add another before removing it, or hide the whole product.",
    };
  }

  await db.productVariant.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: "DELETE_VARIANT",
      entity: "ProductVariant",
      entityId: id,
      meta: JSON.stringify({
        label: variant.label,
        productId: variant.product.id,
        orderItems: variant._count.orderItems,
      }),
    },
  });

  revalidateStore(variant.product.slug);
  return { ok: true, message: `${variant.label} removed.` };
}

/* Product imagery ---------------------------------------------------------- */

/**
 * Store imagery is public by design — it is the shop front — so it is
 * referenced by path rather than going through private-uploads and the
 * ownership check in /api/files. Paths only: an off-site URL would be a
 * third-party request on every shop page, and next/image would reject the host.
 */
export async function addProductImage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const productId = String(formData.get("productId") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  if (!productId) return { error: "Missing product." };
  if (!url.startsWith("/") || url.startsWith("//")) {
    return {
      error: "Use a path inside public/, such as /photos/pods-bowl.webp.",
    };
  }

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { slug: true, _count: { select: { images: true } } },
  });
  if (!product) return { error: "That product no longer exists." };

  await db.productImage.create({
    data: {
      productId,
      url,
      alt: String(formData.get("alt") ?? "").trim() || null,
      sortOrder: product._count.images,
    },
  });

  revalidateStore(product.slug);
  return { ok: true, message: "Image added." };
}

export async function removeProductImage(id: string) {
  await requireAdmin();

  const image = await db.productImage.findUnique({
    where: { id },
    select: { product: { select: { slug: true } } },
  });
  if (!image) return { error: "That image no longer exists." };

  await db.productImage.delete({ where: { id } });

  revalidateStore(image.product.slug);
  return { ok: true };
}

/** Moves an image one place earlier or later. The first one is the thumbnail. */
export async function moveProductImage(id: string, direction: -1 | 1) {
  await requireAdmin();

  const image = await db.productImage.findUnique({
    where: { id },
    select: { id: true, productId: true, sortOrder: true },
  });
  if (!image) return { error: "That image no longer exists." };

  const neighbour = await db.productImage.findFirst({
    where: {
      productId: image.productId,
      sortOrder:
        direction === -1 ? { lt: image.sortOrder } : { gt: image.sortOrder },
    },
    orderBy: { sortOrder: direction === -1 ? "desc" : "asc" },
    select: { id: true, sortOrder: true },
  });
  if (!neighbour) return { ok: true };

  await db.$transaction([
    db.productImage.update({
      where: { id: image.id },
      data: { sortOrder: neighbour.sortOrder },
    }),
    db.productImage.update({
      where: { id: neighbour.id },
      data: { sortOrder: image.sortOrder },
    }),
  ]);

  const product = await db.product.findUnique({
    where: { id: image.productId },
    select: { slug: true },
  });
  revalidateStore(product?.slug);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* DPDP — the request queue, retention and the breach register                 */
/* -------------------------------------------------------------------------- */

/** Working a request: recording what was decided and when it was answered. */
export async function updateDataRequest(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const response = String(formData.get("response") ?? "").trim();

  if (!id) return { error: "Missing request." };
  if (!["RECEIVED", "IN_PROGRESS", "COMPLETED", "REJECTED"].includes(status)) {
    return { error: "Pick a status." };
  }

  // Closing a request without saying what was decided leaves the Data
  // Principal with silence and us with no record of the reasoning — which is
  // exactly what gets asked for if the Board ever looks.
  const closing = status === "COMPLETED" || status === "REJECTED";
  if (closing && !response) {
    return { error: "Write what you told them before closing this." };
  }

  const request = await db.dataRequest.update({
    where: { id },
    data: {
      status,
      response: response || null,
      completedAt: closing ? new Date() : null,
    },
  });

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: "DPDP_REQUEST_UPDATED",
      entity: "DataRequest",
      entityId: id,
      meta: JSON.stringify({ reference: request.reference, status }),
    },
  });

  revalidatePath("/admin/privacy");
  revalidatePath("/dashboard/privacy");
  return { ok: true, message: `${request.reference} updated.` };
}

/**
 * Erasure for a store customer.
 *
 * The order is not deleted, because the books of account behind it are a
 * statutory record — erasing them to satisfy one right would breach a
 * different law. What is erased is the person: name, email, phone and the
 * delivery address. What remains is an order number, a date and an amount,
 * which is no longer personal data because nothing links it to anybody.
 *
 * This is the honest reading of s.8(7): erase what the purpose no longer needs
 * and the law does not require, and be able to say precisely what was kept.
 */
export async function anonymiseCustomer(email: string) {
  const admin = await requireAdmin();
  const subject = email.trim().toLowerCase();
  if (!subject) return { error: "No email given." };

  const orders = await db.order.findMany({
    where: { email: subject },
    select: { id: true, orderNumber: true },
  });
  if (orders.length === 0) {
    return { error: "No orders found for that address." };
  }

  await db.$transaction([
    db.order.updateMany({
      where: { email: subject },
      data: {
        customerName: "Erased at their request",
        email: `erased+${Date.now()}@invalid`,
        phone: "",
        addressLine1: "",
        addressLine2: null,
        city: "",
        state: "",
        pincode: "",
        notes: null,
      },
    }),
    // The consent records go too: they exist to evidence the lawfulness of
    // holding the data, and there is no longer any data for them to justify.
    db.consentRecord.deleteMany({ where: { subject } }),
  ]);

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: "DPDP_CUSTOMER_ERASED",
      entity: "Order",
      meta: JSON.stringify({
        orders: orders.length,
        keptForStatute: "order number, date and amount",
      }),
    },
  });

  revalidatePath("/admin/privacy");
  revalidatePath("/admin/orders");
  return {
    ok: true,
    message: `${orders.length} order(s) stripped of personal details. Order numbers and amounts kept for the accounts.`,
  };
}

/* Retention -------------------------------------------------------------- */

/**
 * s.8(7) erasure, on the schedule the notice publishes.
 *
 * Written as an action Jinto can run rather than a background job because
 * there is no scheduler in this deployment yet — see the assessment for the
 * cron that should replace it. A published retention period that nothing ever
 * enforces is a statement we are not keeping.
 */
export async function runRetentionPurge() {
  const admin = await requireAdmin();

  const result = await purgeExpiredData(admin.id);

  revalidatePath("/admin/privacy");
  revalidatePath("/admin/enquiries");
  return { ok: true, message: describePurge(result) };
}

/* Breach register --------------------------------------------------------- */

/**
 * s.8(6) requires notifying the Board AND every affected Data Principal, with
 * no "low risk" exemption to hide behind — so the record tracks the two
 * notifications separately and neither can be quietly skipped.
 */
export async function recordBreach(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const description = String(formData.get("description") ?? "").trim();
  if (description.length < 10) {
    return { error: "Describe what happened, in a sentence or two." };
  }

  const detectedRaw = String(formData.get("detectedAt") ?? "").trim();
  const detectedAt = detectedRaw ? new Date(detectedRaw) : new Date();
  if (Number.isNaN(detectedAt.getTime())) {
    return { error: "Check the date you found it." };
  }

  const affected = Number(formData.get("affected") ?? 0);

  const breach = await db.breachRecord.create({
    data: {
      reference: makeReference("BR"),
      detectedAt,
      description,
      affected: Number.isFinite(affected) ? Math.max(0, affected) : 0,
    },
  });

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: "DPDP_BREACH_RECORDED",
      entity: "BreachRecord",
      entityId: breach.id,
      meta: JSON.stringify({ reference: breach.reference }),
    },
  });

  revalidatePath("/admin/privacy");
  return {
    ok: true,
    message: `Logged as ${breach.reference}. The Board must be told within ${BREACH_BOARD_HOURS} hours.`,
  };
}

export async function markBreachNotified(
  id: string,
  who: "BOARD" | "PRINCIPALS",
) {
  const admin = await requireAdmin();

  const breach = await db.breachRecord.update({
    where: { id },
    data:
      who === "BOARD"
        ? { boardNotifiedAt: new Date() }
        : { principalsNotifiedAt: new Date() },
  });

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: "DPDP_BREACH_NOTIFIED",
      entity: "BreachRecord",
      entityId: id,
      meta: JSON.stringify({ reference: breach.reference, who }),
    },
  });

  revalidatePath("/admin/privacy");
  return { ok: true };
}

export async function closeBreach(id: string, remediation: string) {
  const admin = await requireAdmin();

  if (!remediation.trim()) {
    return { error: "Say what was done about it before closing." };
  }

  const breach = await db.breachRecord.update({
    where: { id },
    data: { remediation: remediation.trim(), closedAt: new Date() },
  });

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: "DPDP_BREACH_CLOSED",
      entity: "BreachRecord",
      entityId: id,
      meta: JSON.stringify({ reference: breach.reference }),
    },
  });

  revalidatePath("/admin/privacy");
  return { ok: true, message: `${breach.reference} closed.` };
}

/* -------------------------------------------------------------------------- */
/* Permissions — Doc 06 "Manage Permissions"                                   */
/* -------------------------------------------------------------------------- */

/**
 * Grant or revoke one permission for one grower.
 *
 * Three things are enforced here rather than trusted from the screen:
 *
 *  - the key has to be one the catalogue knows, so a crafted request cannot
 *    invent a permission and have it stored;
 *  - the key has to be configurable, so the fixed rights in Doc 06's matrix
 *    cannot be switched off through a route that bypasses the disabled toggle;
 *  - the change is logged, because Doc 06 s.5 requires sensitive actions to be
 *    recorded and "who could see what, and when" is the question this answers
 *    if a grower ever disputes it.
 *
 * Setting a permission back to its role default deletes the row rather than
 * storing the default. That keeps "Jinto decided this" and "nobody has decided"
 * distinguishable, which is the whole point of storing overrides only.
 */
export async function setClientPermission(
  clientId: string,
  key: string,
  allowed: boolean,
) {
  const admin = await requireAdmin();

  const permission = permissionByKey(key);
  if (!permission) return { error: "Unknown permission." };
  if (!permission.configurable) {
    return { error: `"${permission.label}" comes with the account and cannot be switched off.` };
  }

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true },
  });
  if (!client) return { error: "That client no longer exists." };

  const isDefault = allowed === roleDefault("CLIENT", key);

  if (isDefault) {
    await db.clientPermission.deleteMany({ where: { clientId, key } });
  } else {
    await db.clientPermission.upsert({
      where: { clientId_key: { clientId, key } },
      create: { clientId, key, allowed, setByUserId: admin.id },
      update: { allowed, setByUserId: admin.id },
    });
  }

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: allowed ? "PERMISSION_GRANTED" : "PERMISSION_REVOKED",
      entity: "Client",
      entityId: clientId,
      meta: JSON.stringify({
        key,
        label: permission.label,
        client: client.name,
        backToDefault: isDefault,
      }),
    },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/permissions");
  // The grower's own screens change shape with their permissions, so the
  // portal has to be invalidated too or they keep seeing the old shell.
  revalidatePath("/dashboard", "layout");

  return {
    ok: true,
    message: `${permission.label}: ${allowed ? "allowed" : "not allowed"} for ${client.name}.`,
  };
}

/** Clears every override for a grower, putting them back on the defaults. */
export async function resetClientPermissions(clientId: string) {
  const admin = await requireAdmin();

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { name: true },
  });
  if (!client) return { error: "That client no longer exists." };

  const removed = await db.clientPermission.deleteMany({ where: { clientId } });
  if (removed.count === 0) {
    return { ok: true, message: "Already on the defaults — nothing to reset." };
  }

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: "PERMISSIONS_RESET",
      entity: "Client",
      entityId: clientId,
      meta: JSON.stringify({ client: client.name, cleared: removed.count }),
    },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/permissions");
  revalidatePath("/dashboard", "layout");

  return {
    ok: true,
    message: `${client.name} is back on the standard permissions.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Enquiries from the public contact form                                      */
/* -------------------------------------------------------------------------- */

/**
 * Mark an enquiry as answered or closed.
 *
 * Deliberately no reply-from-here: there is no mail infrastructure, and a
 * "reply" box that quietly went nowhere is precisely the bug this whole feature
 * exists to fix. Jinto answers by phone, WhatsApp or his own email and records
 * here that he did.
 */
export async function updateEnquiryStatus(id: string, status: string) {
  const admin = await requireAdmin();

  if (!["NEW", "REPLIED", "CLOSED"].includes(status)) {
    return { error: "Unknown status." };
  }

  const enquiry = await db.enquiry.update({
    where: { id },
    data: {
      status,
      handledAt: status === "NEW" ? null : new Date(),
      handledById: status === "NEW" ? null : admin.id,
    },
  });

  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: "ENQUIRY_UPDATED",
      entity: "Enquiry",
      entityId: id,
      meta: JSON.stringify({ reference: enquiry.reference, status }),
    },
  });

  revalidatePath("/admin/enquiries");
  return { ok: true, message: `${enquiry.reference} marked ${status.toLowerCase()}.` };
}
