"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";

/**
 * Demo only — this does not send anything yet. Wiring it up needs a decision
 * on where enquiries should land (email, or a table in the admin), which is
 * still open.
 */
export function ContactForm() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <Card>
        <CardBody className="py-14 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <h2 className="mt-4 font-display text-2xl text-forest">Thank you!</h2>
          <p className="mt-2 text-sm text-body">
            Your message has been sent successfully. We&rsquo;ll get back to you
            within a day.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-6"
            onClick={() => setSent(false)}
          >
            Send another
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
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

          <Button type="submit" size="lg" className="w-full">
            <Send className="size-4" /> Send message
          </Button>

          <p className="text-center text-xs text-muted">
            Demo form — not yet connected to email.
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
