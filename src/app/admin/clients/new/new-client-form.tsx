"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  Field,
  Input,
  Label,
  Textarea,
} from "@/components/ui";
import { createClient, type ActionState } from "../../actions";

export function NewClientForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createClient,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-forest">Add a client</h1>
        <p className="mt-1 text-sm text-muted">
          Creates their login too. You&rsquo;ll get a temporary password to pass
          on — they set their own on first sign-in.
        </p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <Label>Grower details</Label>
          <Field label="Full name">
            <Input name="name" placeholder="Thomas Mathew" required />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone">
              <Input name="phone" type="tel" inputMode="tel" placeholder="9847012345" />
            </Field>
            <Field label="WhatsApp" hint="Leave blank to use the phone number.">
              <Input name="whatsapp" type="tel" inputMode="tel" />
            </Field>
          </div>
          <Field label="Email" hint="This is their username for signing in.">
            <Input
              name="email"
              type="email"
              inputMode="email"
              placeholder="thomas@example.com"
              required
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Village">
              <Input name="village" placeholder="Vandanmedu" />
            </Field>
            <Field label="Address">
              <Input name="address" placeholder="Cheruvally House" />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <Label>First estate</Label>
          <p className="-mt-2 text-xs text-muted">
            You can add more estates for this grower afterwards.
          </p>
          <Field label="Estate name">
            <Input name="plotName" placeholder="Cheruvally Estate" required />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Location">
              <Input name="plotLocation" placeholder="Vandanmedu" />
            </Field>
            <Field label="Area (acres)">
              <Input
                name="plotArea"
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder="4.5"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Field label="Notes (private to you)">
            <Textarea name="notes" rows={3} />
          </Field>
        </CardBody>
      </Card>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg bg-danger/8 px-3 py-2.5 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Creating…
          </>
        ) : (
          "Create client and login"
        )}
      </Button>
    </form>
  );
}
