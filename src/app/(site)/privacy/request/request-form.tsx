"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import {
  Button,
  ButtonLink,
  Card,
  CardBody,
  Field,
  Input,
  Label,
  Textarea,
} from "@/components/ui";
import { GRIEVANCE_OFFICER, REQUEST_KINDS, RESPONSE_DAYS } from "@/lib/dpdp";
import { shortDate } from "@/lib/utils";
import { submitDataRequest } from "../actions";

export function RequestForm() {
  const [state, action, pending] = useActionState(submitDataRequest, {});

  if (state.reference) {
    return (
      <Card>
        <CardBody className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <h1 className="font-display text-2xl text-forest">
            We have your request
          </h1>
          <p className="text-body">
            Your reference is{" "}
            <strong className="font-mono text-forest">{state.reference}</strong>
            . Write it down — quoting it saves you explaining the whole thing
            again.
          </p>
          <p className="text-sm text-muted">
            We will reply by{" "}
            {state.dueBy ? shortDate(state.dueBy) : `within ${RESPONSE_DAYS} days`}
            . Before we hand over or erase anything we will call you on the
            number we hold, to be sure it is really you asking.
          </p>
          <div className="pt-1">
            <ButtonLink href="/" variant="outline">
              Back to the site
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <Link
        href="/privacy"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-forest"
      >
        <ArrowLeft className="size-4" /> Privacy notice
      </Link>

      <div>
        <h1 className="font-display text-3xl text-forest sm:text-4xl">
          Ask us about your data
        </h1>
        <p className="mt-3 leading-relaxed text-body">
          Tell us what you would like us to do and we will answer within{" "}
          {RESPONSE_DAYS} days. This costs nothing, and asking will never affect
          the service you get from us.
        </p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-forest">
              What would you like us to do?
            </legend>
            <div className="space-y-2">
              {REQUEST_KINDS.map((kind, index) => (
                <label
                  key={kind.key}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3.5 hover:border-moss/50"
                >
                  <input
                    type="radio"
                    name="kind"
                    value={kind.key}
                    defaultChecked={index === 0}
                    className="mt-0.5 size-4 shrink-0 accent-forest"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-forest">
                      {kind.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {kind.blurb}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor="dpr-name">Your name</Label>
              <Input id="dpr-name" name="name" autoComplete="name" required />
            </Field>
            <Field>
              <Label htmlFor="dpr-phone">Phone</Label>
              <Input
                id="dpr-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
              />
            </Field>
          </div>

          <Field>
            <Label htmlFor="dpr-email">Email</Label>
            <Input
              id="dpr-email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            <p className="mt-1 text-xs text-muted">
              Use the address we already have for you, if you can — it helps us
              find your records.
            </p>
          </Field>

          <Field>
            <Label htmlFor="dpr-details">Anything else we should know</Label>
            <Textarea id="dpr-details" name="details" rows={4} />
            <p className="mt-1 text-xs text-muted">
              For a correction, tell us what is wrong and what it should say.
            </p>
          </Field>

          {state.error ? (
            <p
              role="alert"
              className="rounded-lg bg-danger/8 px-3 py-2 text-sm text-danger"
            >
              {state.error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Send the request
          </Button>

          <p className="text-center text-xs text-muted">
            Would rather talk? Call {GRIEVANCE_OFFICER.name.split(" ")[0]} on{" "}
            <a
              href={`tel:${GRIEVANCE_OFFICER.phone}`}
              className="underline hover:text-forest"
            >
              {GRIEVANCE_OFFICER.phoneDisplay}
            </a>
            .
          </p>
        </CardBody>
      </Card>
    </form>
  );
}
