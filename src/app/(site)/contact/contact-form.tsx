"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { ConsentNotice } from "@/components/consent-notice";
import { sendEnquiry } from "./actions";

/**
 * Enquiries land in the admin rather than an inbox — there is no mail
 * infrastructure yet, and storing one Jinto can answer beats the previous
 * behaviour, which reported success and dropped the message.
 */
export function ContactForm({
  phone,
  phoneDisplay,
  firstName,
}: {
  /* Passed in rather than imported: these are editable in the admin now, and a
     client component cannot read them. See src/lib/site-content.ts. */
  phone: string;
  phoneDisplay: string;
  firstName: string;
}) {
  const [state, action, pending] = useActionState(sendEnquiry, {});

  if (state.reference) {
    return (
      <Card>
        <CardBody className="py-14 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <h2 className="mt-4 font-display text-2xl text-forest">Thank you!</h2>
          <p className="mt-2 text-sm text-body">
            We have your message and will come back to you within a day. Your
            reference is{" "}
            <strong className="font-mono text-forest">{state.reference}</strong>.
          </p>
          <p className="mt-2 text-xs text-muted">
            In a hurry? Ring {firstName} on{" "}
            <a
              href={`tel:${phone}`}
              className="underline hover:text-forest"
            >
              {phoneDisplay}
            </a>
            .
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <form action={action} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Your name">
              <Input name="name" autoComplete="name" required />
            </Field>
            <Field label="Phone">
              <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" />
            </Field>
          </div>

          <Field label="Email">
            <Input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
            />
          </Field>

          <Field label="What is this about?">
            <Select name="topic" defaultValue="buying">
              <option value="buying">Buying cardamom</option>
              <option value="wholesale">Wholesale / bulk quantity</option>
              <option value="estate">Having my estate managed</option>
              <option value="other">Something else</option>
            </Select>
          </Field>

          <Field label="Message">
            <Textarea name="message" rows={5} required />
          </Field>

          <ConsentNotice purposeKey="ENQUIRY" />

          {state.error ? (
            <p
              role="alert"
              className="rounded-lg bg-danger/8 px-3 py-2 text-sm text-danger"
            >
              {state.error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send message
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
