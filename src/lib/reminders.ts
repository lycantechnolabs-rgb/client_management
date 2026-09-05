import { getRoundBoard } from "@/lib/queries";
import { describeCycle, type PlotCycle } from "@/lib/cycle";
import {
  NOTIFICATION_KINDS,
  adminRecipient,
  queueNotification,
} from "@/lib/notify";
// These go to Jinto as a notification, not to a grower on a screen.
import { englishT } from "@/lib/i18n";

/**
 * The daily "what is due" note.
 *
 * The work of deciding what is due was already done — computeCycle has known
 * about 45-day picking rounds and late fertilizer since the round board was
 * built. It simply had no way of reaching anyone who was not already looking at
 * a screen. This is the delivery half.
 *
 * One digest rather than a message per plot. Six alerts arriving separately at
 * dawn is how a person learns to ignore alerts.
 */

/**
 * Why this plot is on the list.
 *
 * describeCycle answers a different question — when the next picking falls —
 * and using it here produced a digest headed "rounds due today" whose every
 * line read "next picking in 12 days". Those plots were listed because their
 * follow-up fertilizer or spray was late, which the picking sentence never
 * mentions. A reminder that cannot say why it fired is worse than none: it
 * teaches the person reading it that the reminders are wrong.
 */
function reasonFor(c: PlotCycle): string {
  const parts: string[] = [];

  if (c.status === "overdue" || c.status === "due") {
    parts.push(describeCycle(c, englishT).toLowerCase());
  }
  if (c.fertilizerOverdue) parts.push("fertilizer round late");
  if (c.sprayOverdue) parts.push("spray round late");

  if (parts.length === 0) return describeCycle(c, englishT).toLowerCase();

  // Picking is still useful context when it is the follow-up that is late.
  if (c.status !== "overdue" && c.status !== "due") {
    parts.push(describeCycle(c, englishT).toLowerCase());
  }

  return parts.join(", ");
}

export async function queueRoundReminders(today = new Date()) {
  const admin = await adminRecipient();
  if (!admin) return { queued: false, reason: "no admin" as const };

  const board = await getRoundBoard();

  const urgent = board.filter(
    (r) =>
      r.cycle.status === "overdue" ||
      r.cycle.status === "due" ||
      r.cycle.fertilizerOverdue ||
      r.cycle.sprayOverdue,
  );

  if (urgent.length === 0) {
    return { queued: false, reason: "nothing due" as const };
  }

  const lines = urgent
    .slice(0, 12)
    .map((r) => `• ${r.clientName} — ${r.plotName}: ${reasonFor(r.cycle)}`);

  const more = urgent.length > 12 ? [`…and ${urgent.length - 12} more.`] : [];

  const body = [
    `${urgent.length} estate${urgent.length === 1 ? "" : "s"} need attention:`,
    "",
    ...lines,
    ...more,
    "",
    "Open the admin to log the work.",
  ].join("\n");

  // Dated key: a cron that fires twice, or a manual run on the same day, still
  // sends one digest.
  const dedupeKey = `rounds-due:${today.toISOString().slice(0, 10)}`;

  const result = await queueNotification({
    kind: NOTIFICATION_KINDS.ROUNDS_DUE,
    body,
    toName: admin.name ?? "Jinto",
    toPhone: admin.phone,
    toEmail: admin.email,
    userId: admin.id,
    dedupeKey,
  });

  return { ...result, plots: urgent.length };
}
