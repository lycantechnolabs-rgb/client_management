/**
 * Where a notification actually goes.
 *
 * The rest of the app queues notifications without knowing or caring how they
 * travel. This file is the only place that knows, so adding WhatsApp later is
 * one adapter and an environment variable — not a change to every action that
 * wants to tell somebody something.
 *
 * Selected with NOTIFY_DRIVER. Unset means "console", which is the honest
 * default for a demo: it records the notification and marks it sent so the
 * whole pipeline is exercised and visible, without pretending a message reached
 * anyone's phone.
 */

export type OutgoingNotification = {
  id: string;
  kind: string;
  toName: string;
  toPhone: string | null;
  toEmail: string | null;
  body: string;
};

export type SendResult = { ok: true } | { ok: false; error: string };

export type NotificationProvider = {
  /** Stored on the row, so the outbox says how each one travelled. */
  channel: string;
  send(notification: OutgoingNotification): Promise<SendResult>;
};

/* -------------------------------------------------------------------------- */

/**
 * The default. Writes the message to the server log and reports success.
 *
 * Deliberately reports success rather than failure: the point is to exercise
 * queueing, dispatch, dedupe and the outbox view end to end. What it must never
 * do is let anyone believe a grower was contacted — which is why every screen
 * that shows these says the channel is the server log, and why the driver name
 * is recorded on the row.
 */
const consoleProvider: NotificationProvider = {
  channel: "CONSOLE",
  async send(n) {
    console.log(
      `[notify] ${n.kind} → ${n.toName} ${n.toPhone ?? n.toEmail ?? "(no address)"}\n${n.body}\n`,
    );
    return { ok: true };
  },
};

/**
 * WhatsApp Business Cloud API.
 *
 * Not wired to a live account — there is no number provisioned yet. It is left
 * as the shape the real thing takes rather than as a stub that silently
 * succeeds: with no credentials it fails loudly, the row goes to FAILED with
 * the reason on it, and nobody is told a grower was messaged when they were
 * not.
 *
 * To finish it: provision a number, set WHATSAPP_TOKEN and WHATSAPP_PHONE_ID,
 * and get the message templates approved — the Cloud API will not deliver
 * free-form text outside a 24-hour customer service window, so each `kind`
 * below needs a registered template before any of this reaches a phone.
 */
const whatsappProvider: NotificationProvider = {
  channel: "WHATSAPP",
  async send(n) {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
      return {
        ok: false,
        error:
          "WHATSAPP_TOKEN / WHATSAPP_PHONE_ID are not set — nothing was sent.",
      };
    }
    if (!n.toPhone) {
      return { ok: false, error: "No phone number on file for this recipient." };
    }

    // Indian numbers are stored as ten digits; the API wants them dialled.
    const digits = n.toPhone.replace(/\D/g, "").slice(-10);
    if (digits.length !== 10) {
      return { ok: false, error: `"${n.toPhone}" is not a 10-digit number.` };
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${phoneId}/messages`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: `91${digits}`,
            type: "text",
            text: { body: n.body },
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!res.ok) {
        const detail = await res.text();
        return { ok: false, error: `${res.status}: ${detail.slice(0, 200)}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "send failed" };
    }
  },
};

const PROVIDERS: Record<string, NotificationProvider> = {
  console: consoleProvider,
  whatsapp: whatsappProvider,
};

export function activeProvider(): NotificationProvider {
  const name = (process.env.NOTIFY_DRIVER ?? "console").toLowerCase();
  return PROVIDERS[name] ?? consoleProvider;
}

/** Shown in the admin so nobody has to guess whether anything is really sent. */
export function providerName() {
  return (process.env.NOTIFY_DRIVER ?? "console").toLowerCase();
}
