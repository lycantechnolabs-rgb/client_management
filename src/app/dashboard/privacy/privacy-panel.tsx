"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Field,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import { purposeLabel, requestStatus } from "@/lib/dpdp";
import { shortDate } from "@/lib/utils";
import { raisePortalRequest, saveNomination, withdrawConsent } from "./actions";

export type ConsentView = {
  purpose: string;
  granted: boolean;
  noticeVersion: string;
  createdAt: string;
};

export type RequestView = {
  reference: string;
  kind: string;
  status: string;
  details: string | null;
  response: string | null;
  createdAt: string;
  dueBy: string;
};

export type NomineeView = {
  name: string | null;
  phone: string | null;
  relation: string | null;
};

function Feedback({ state }: { state: { error?: string; message?: string } }) {
  if (state.error) return <p className="text-sm text-danger">{state.error}</p>;
  if (state.message) return <p className="text-sm text-moss">{state.message}</p>;
  return null;
}

/* -------------------------------------------------------------------------- */

export function NominationCard({ nominee }: { nominee: NomineeView }) {
  const [state, setState] = useState<{ error?: string; message?: string }>({});
  const [saving, startSaving] = useTransition();

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSaving(async () => setState(await saveNomination({}, data)));
  }

  return (
    <Card variant="glass">
      <CardBody className="space-y-4">
        <div>
          <CardTitle>Someone who can act for you</CardTitle>
          <p className="mt-1.5 text-sm text-body">
            You can name a person who may ask us about your data on your behalf
            if you die or become unable to. Leave it blank if you would rather
            not — nothing depends on it.
          </p>
        </div>

        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <Label htmlFor="nom-name">Their name</Label>
              <Input
                id="nom-name"
                name="nomineeName"
                defaultValue={nominee.name ?? ""}
              />
            </Field>
            <Field>
              <Label htmlFor="nom-phone">Their phone</Label>
              <Input
                id="nom-phone"
                name="nomineePhone"
                inputMode="tel"
                defaultValue={nominee.phone ?? ""}
              />
            </Field>
          </div>
          <Field>
            <Label htmlFor="nom-rel">How you know them</Label>
            <Input
              id="nom-rel"
              name="nomineeRelation"
              placeholder="Son, daughter, brother…"
              defaultValue={nominee.relation ?? ""}
            />
          </Field>
          <Feedback state={state} />
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

export function ConsentCard({ consents }: { consents: ConsentView[] }) {
  const [state, setState] = useState<{ error?: string; message?: string }>({});
  const [pending, startTransition] = useTransition();

  // Only the latest row per purpose says what is true now; the older rows are
  // the history behind it.
  const current = new Map<string, ConsentView>();
  for (const c of consents) {
    if (!current.has(c.purpose)) current.set(c.purpose, c);
  }
  const live = [...current.values()];

  return (
    <Card variant="glass">
      <CardBody className="space-y-4">
        <div>
          <CardTitle>Permissions you have given</CardTitle>
          <p className="mt-1.5 text-sm text-body">
            Taking a permission back is as easy as giving it. Some of what we
            hold does not sit on a permission at all — your work log is part of
            the service you asked us for — so it will not appear here.
          </p>
        </div>

        {live.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing recorded against a permission yet.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {live.map((c) => (
              <li
                key={c.purpose}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-body">
                    {purposeLabel(c.purpose)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {c.granted ? "Given" : "Withdrawn"} {shortDate(c.createdAt)} ·
                    notice {c.noticeVersion}
                  </span>
                </span>
                {c.granted ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () =>
                        setState(await withdrawConsent(c.purpose)),
                      )
                    }
                  >
                    Withdraw
                  </Button>
                ) : (
                  <Badge tone="muted">Withdrawn</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        <Feedback state={state} />
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

export function RequestCard({ requests }: { requests: RequestView[] }) {
  const [state, setState] = useState<{ error?: string; message?: string }>({});
  const [saving, startSaving] = useTransition();

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startSaving(async () => {
      const result = await raisePortalRequest({}, data);
      setState(result);
      if (result.ok) form.reset();
    });
  }

  return (
    <Card variant="glass">
      <CardBody className="space-y-4">
        <div>
          <CardTitle>Ask us to change something</CardTitle>
          <p className="mt-1.5 text-sm text-body">
            We answer within 30 days. Because you are signed in, we already know
            it is you — no callback needed.
          </p>
        </div>

        <form onSubmit={save} className="space-y-3">
          <Field>
            <Label htmlFor="req-kind">What do you need?</Label>
            <Select id="req-kind" name="kind" defaultValue="CORRECTION">
              <option value="CORRECTION">Correct something that is wrong</option>
              <option value="ERASURE">Erase my data</option>
              <option value="ACCESS">Explain what you hold about me</option>
              <option value="GRIEVANCE">Raise a complaint</option>
            </Select>
          </Field>
          <Field>
            <Label htmlFor="req-details">Tell us more</Label>
            <Textarea id="req-details" name="details" rows={3} required />
          </Field>
          <Feedback state={state} />
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Send
          </Button>
        </form>

        {requests.length > 0 ? (
          <div className="border-t border-line-soft pt-4">
            <p className="text-sm font-medium text-forest">
              What you have asked before
            </p>
            <ul className="mt-2 divide-y divide-line-soft">
              {requests.map((r) => {
                const status = requestStatus(r.status);
                return (
                  <li key={r.reference} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-forest">
                        {r.reference}
                      </span>
                      <Badge tone={status?.tone ?? "muted"}>
                        {status?.label ?? r.status}
                      </Badge>
                      <span className="text-xs text-muted">
                        raised {shortDate(r.createdAt)}
                        {r.status === "RECEIVED" || r.status === "IN_PROGRESS"
                          ? ` · reply due ${shortDate(r.dueBy)}`
                          : ""}
                      </span>
                    </div>
                    {r.details ? (
                      <p className="mt-1 text-sm text-body">{r.details}</p>
                    ) : null}
                    {r.response ? (
                      <p className="mt-1.5 rounded-lg bg-tint/40 px-3 py-2 text-sm text-body">
                        <span className="font-medium text-forest">
                          Our reply:{" "}
                        </span>
                        {r.response}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
