"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail, MessageCircle, Phone } from "lucide-react";
import { Badge, Button, Card, CardBody, EmptyState } from "@/components/ui";
import { shortDate } from "@/lib/utils";
import { updateEnquiryStatus } from "../actions";

export type EnquiryRow = {
  id: string;
  reference: string;
  name: string;
  email: string;
  phone: string | null;
  topic: string;
  message: string;
  status: string;
  createdAt: string;
  handledBy: string | null;
};

const TOPIC_LABEL: Record<string, string> = {
  buying: "Buying cardamom",
  wholesale: "Wholesale / bulk",
  estate: "Estate management",
  other: "Something else",
};

const STATUS_TONE: Record<string, "info" | "success" | "muted"> = {
  NEW: "info",
  REPLIED: "success",
  CLOSED: "muted",
};

function Row({ enquiry }: { enquiry: EnquiryRow }) {
  const [state, setState] = useState<{ error?: string; message?: string }>({});
  const [pending, startTransition] = useTransition();

  function set(status: string) {
    startTransition(async () => setState(await updateEnquiryStatus(enquiry.id, status)));
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-forest">
            {enquiry.reference}
          </span>
          <Badge tone={STATUS_TONE[enquiry.status] ?? "muted"}>
            {enquiry.status === "NEW"
              ? "New"
              : enquiry.status === "REPLIED"
                ? "Replied"
                : "Closed"}
          </Badge>
          <span className="text-sm text-body">
            {TOPIC_LABEL[enquiry.topic] ?? enquiry.topic}
          </span>
          <span className="text-xs text-muted">
            {shortDate(enquiry.createdAt)}
            {enquiry.handledBy ? ` · by ${enquiry.handledBy}` : ""}
          </span>
        </div>

        <div>
          <p className="font-medium text-forest">{enquiry.name}</p>
          {/* Tap-to-act rather than copy-and-paste: Jinto answers these from a
              phone, and the reply happens outside the app. */}
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <a
              href={`mailto:${enquiry.email}?subject=${encodeURIComponent(
                `Your enquiry ${enquiry.reference}`,
              )}`}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-moss hover:underline"
            >
              <Mail className="size-4" /> {enquiry.email}
            </a>
            {enquiry.phone ? (
              <>
                <a
                  href={`tel:${enquiry.phone}`}
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm text-moss hover:underline"
                >
                  <Phone className="size-4" /> {enquiry.phone}
                </a>
                <a
                  href={`https://wa.me/91${enquiry.phone.replace(/\D/g, "").slice(-10)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm text-moss hover:underline"
                >
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </>
            ) : null}
          </div>
        </div>

        <p className="whitespace-pre-wrap rounded-lg bg-tint/40 px-3 py-2.5 text-sm leading-relaxed text-body">
          {enquiry.message}
        </p>

        {state.error ? (
          <p className="text-sm text-danger">{state.error}</p>
        ) : null}
        {state.message ? (
          <p className="text-sm text-moss">{state.message}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {enquiry.status !== "REPLIED" ? (
            <Button
              type="button"
              size="sm"
              variant="soft"
              disabled={pending}
              onClick={() => set("REPLIED")}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Mark replied
            </Button>
          ) : null}
          {enquiry.status !== "CLOSED" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => set("CLOSED")}
            >
              Close
            </Button>
          ) : null}
          {enquiry.status !== "NEW" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => set("NEW")}
            >
              Reopen
            </Button>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

export function EnquiryList({ enquiries }: { enquiries: EnquiryRow[] }) {
  const open = enquiries.filter((e) => e.status === "NEW");
  const done = enquiries.filter((e) => e.status !== "NEW");

  if (enquiries.length === 0) {
    return (
      <EmptyState
        title="No enquiries yet"
        description="Messages from the contact form on the website land here."
      />
    );
  }

  return (
    <div className="space-y-5">
      {open.length > 0 ? (
        <div className="space-y-3">
          {open.map((e) => (
            <Row key={e.id} enquiry={e} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Nothing new — all caught up.</p>
      )}

      {done.length > 0 ? (
        <details className="border-t border-line-soft pt-4">
          <summary className="cursor-pointer text-sm text-muted hover:text-forest">
            {done.length} dealt with
          </summary>
          <div className="mt-3 space-y-3">
            {done.map((e) => (
              <Row key={e.id} enquiry={e} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
