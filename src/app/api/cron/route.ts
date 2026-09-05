import { dispatchNotifications } from "@/lib/notify";
import { queueRoundReminders } from "@/lib/reminders";
import { purgeExpiredData, describePurge } from "@/lib/retention";

/**
 * The scheduled job. One endpoint, run daily — see vercel.json.
 *
 * Authentication is a shared secret in the Authorization header, which is what
 * Vercel Cron sends. There is deliberately no development escape hatch: an
 * endpoint that erases personal data on a timer is not one to leave open
 * because a secret happened to be unset. With CRON_SECRET missing this refuses
 * and says so, rather than running unauthenticated.
 *
 * Order matters. Reminders are queued before the outbox is drained, so anything
 * raised this morning goes out on the same run instead of waiting a day.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET is not set — refusing to run." },
      { status: 503 },
    );
  }

  const offered = request.headers.get("authorization");
  if (offered !== `Bearer ${secret}`) {
    return new Response("Not found", { status: 404 });
  }

  const startedAt = Date.now();

  const reminders = await queueRoundReminders();
  const dispatch = await dispatchNotifications();
  const purge = await purgeExpiredData(null);

  return Response.json({
    ok: true,
    ranFor: `${Date.now() - startedAt}ms`,
    reminders,
    dispatch,
    purge: { ...purge, summary: describePurge(purge) },
  });
}

/**
 * Vercel Cron issues GET. Same work, same guard — kept as a thin alias rather
 * than duplicating the body.
 */
export async function GET(request: Request) {
  return POST(request);
}
