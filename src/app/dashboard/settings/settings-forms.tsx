"use client";

import { useActionState } from "react";
import { KeyRound, Loader2, Save } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Field,
  Input,
  Label,
} from "@/components/ui";
import { changePassword, updateOwnContact } from "./actions";

function Feedback({ state }: { state: { error?: string; message?: string } }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-lg bg-danger/8 px-3 py-2 text-sm text-danger"
      >
        {state.error}
      </p>
    );
  }
  if (state.message) return <p className="text-sm text-moss">{state.message}</p>;
  return null;
}

export type PasswordWords = {
  heading: string;
  current: string;
  next: string;
  confirm: string;
  hint: string;
  submit: string;
};

export function PasswordForm({
  mustChange,
  w,
}: {
  mustChange: boolean;
  /**
   * The words, passed in rather than looked up here.
   *
   * This is a client component: importing the translator would ship the whole
   * catalogue, both languages, to every browser that opens the page.
   */
  w: PasswordWords;
}) {
  const [state, action, pending] = useActionState(changePassword, {});

  return (
    <Card
      id="password"
      variant="glass"
      className={mustChange ? "border-warning/50" : undefined}
    >
      <CardBody className="space-y-4">
        <CardTitle>{w.heading}</CardTitle>

        {mustChange ? (
          <p className="rounded-lg bg-warning/10 px-3 py-2.5 text-sm text-body">
            You are still using the temporary password Jinto gave you. Pick your
            own — he cannot see what you choose.
          </p>
        ) : null}

        <form action={action} className="space-y-4">
          <Field>
            <Label htmlFor="pw-current">{w.current}</Label>
            <Input
              id="pw-current"
              name="current"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Field>
            <Label htmlFor="pw-next">{w.next}</Label>
            <Input
              id="pw-next"
              name="next"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p className="mt-1 text-xs text-muted">
              {w.hint}
            </p>
          </Field>
          <Field>
            <Label htmlFor="pw-confirm">{w.confirm}</Label>
            <Input
              id="pw-confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>

          <Feedback state={state} />

          <Button type="submit" disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            {w.submit}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export type ContactWords = {
  heading: string;
  body: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  submit: string;
  emailFixed: string;
};

export function ContactForm({
  w,
  phone,
  whatsapp,
  email,
  address,
}: {
  /** The words, for the same reason as the password form above. */
  w: ContactWords;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
}) {
  const [state, action, pending] = useActionState(updateOwnContact, {});

  return (
    <Card variant="glass">
      <CardBody className="space-y-4">
        <div>
          <CardTitle>{w.heading}</CardTitle>
          <p className="mt-1.5 text-sm text-body">
            {w.body}
            Your estate records themselves are kept by Jinto — ring him if
            something there looks wrong.
          </p>
        </div>

        <form action={action} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor="ct-phone">{w.phone}</Label>
              <Input
                id="ct-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                defaultValue={phone}
              />
            </Field>
            <Field>
              <Label htmlFor="ct-whatsapp">{w.whatsapp}</Label>
              <Input
                id="ct-whatsapp"
                name="whatsapp"
                type="tel"
                inputMode="tel"
                defaultValue={whatsapp}
              />
            </Field>
          </div>

          <Field>
            <Label htmlFor="ct-email">{w.email}</Label>
            <Input id="ct-email" value={email} disabled readOnly />
            <p className="mt-1 text-xs text-muted">
              {w.emailFixed}
            </p>
          </Field>

          <Field>
            <Label htmlFor="ct-address">{w.address}</Label>
            <Input id="ct-address" name="address" defaultValue={address} />
          </Field>

          <Feedback state={state} />

          <Button type="submit" disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {w.submit}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
