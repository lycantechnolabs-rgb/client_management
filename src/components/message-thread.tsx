"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, SendHorizonal } from "lucide-react";
import { Button, Card, CardBody, EmptyState } from "@/components/ui";
import type { ThreadMessage } from "@/lib/messages";
import { sendMessage } from "@/app/messages-actions";

/**
 * One conversation, used by both portals.
 *
 * Deliberately not a chat app: there is no polling, no typing indicator and no
 * live socket. Messages arrive when the page is next loaded. For two people
 * exchanging a few notes a week about an estate that is the honest shape, and
 * the alternative would burn a grower's data allowance holding a connection
 * open for something that changes twice a month.
 */
export function MessageThread({
  messages,
  clientId,
  placeholder,
  emptyTitle,
  labelWord = "Your message",
  sendWord = "Send",
  locale = "en",
  emptyDescription,
}: {
  messages: ThreadMessage[];
  /** Only the admin sends this; a grower's thread comes from their session. */
  clientId?: string;
  placeholder: string;
  emptyTitle: string;
  /** The two fixed words on the composer, in the reader's language. */
  /** For the timestamps; the rest of the words arrive as props. */
  locale?: string;
  labelWord?: string;
  sendWord?: string;
  emptyDescription: string;
}) {
  const [state, action, pending] = useActionState(sendMessage, {});
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const count = messages.length;

  // Land on the newest message, the way any conversation is read.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [count]);

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={m.mine ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={`max-w-[85%] rounded-[--radius-card] px-3.5 py-2.5 sm:max-w-[75%] ${
                  m.mine
                    ? "bg-forest text-cream"
                    : "border border-line bg-surface text-body"
                }`}
              >
                {!m.mine ? (
                  <p className="mb-0.5 text-xs font-medium text-moss">
                    {m.senderName}
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {m.body}
                </p>
                <p
                  className={`mt-1 text-[11px] ${
                    m.mine ? "text-cream/60" : "text-muted"
                  }`}
                >
                  {new Date(m.createdAt).toLocaleString(locale === "ml" ? "ml-IN" : "en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {m.mine && m.readAt ? " · read" : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div ref={endRef} />

      <Card>
        <CardBody>
          <form
            ref={formRef}
            action={async (formData) => {
              await action(formData);
              formRef.current?.reset();
            }}
            className="space-y-3"
          >
            {clientId ? (
              <input type="hidden" name="clientId" value={clientId} />
            ) : null}

            <label htmlFor="msg-body" className="sr-only">
              {labelWord}
            </label>
            <textarea
              id="msg-body"
              name="body"
              rows={3}
              required
              maxLength={4000}
              placeholder={placeholder}
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-base text-ink placeholder:text-muted/60 focus:border-moss focus:outline-none"
            />

            {state.error ? (
              <p
                role="alert"
                className="rounded-lg bg-danger/8 px-3 py-2 text-sm text-danger"
              >
                {state.error}
              </p>
            ) : null}

            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SendHorizonal className="size-4" />
              )}
              {sendWord}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
