"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, ShieldAlert, Trash2 } from "lucide-react";
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
import {
  BREACH_BOARD_HOURS,
  requestKindLabel,
  requestStatus,
} from "@/lib/dpdp";
import { shortDate } from "@/lib/utils";
import {
  anonymiseCustomer,
  closeBreach,
  markBreachNotified,
  recordBreach,
  runRetentionPurge,
  updateDataRequest,
} from "../actions";

import type { AdminRequestRow, BreachRow } from "@/lib/dpdp-admin";

function Feedback({ state }: { state: { error?: string; message?: string } }) {
  if (state.error) return <p className="text-sm text-danger">{state.error}</p>;
  if (state.message) return <p className="text-sm text-moss">{state.message}</p>;
  return null;
}

/* -------------------------------------------------------------------------- */

function RequestRow({ request }: { request: AdminRequestRow }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ error?: string; message?: string }>({});
  const [saving, startSaving] = useTransition();
  const status = requestStatus(request.status);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSaving(async () => {
      const result = await updateDataRequest({}, data);
      setState(result);
      if (result.ok) setOpen(false);
    });
  }

  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-forest">
              {request.reference}
            </span>
            <Badge tone={status?.tone ?? "muted"}>
              {status?.label ?? request.status}
            </Badge>
            <span className="text-sm text-body">
              {requestKindLabel(request.kind)}
            </span>
            {request.overdue ? (
              <Badge tone="danger">
                <AlertTriangle className="size-3" /> Overdue
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-body">
            {request.name}
            <span className="text-muted"> · {request.subject}</span>
            {request.phone ? (
              <span className="text-muted"> · {request.phone}</span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Raised {shortDate(request.createdAt)} · due{" "}
            {shortDate(request.dueBy)}
            {request.clientId ? " · has a portal account" : " · store customer"}
          </p>
          {request.details ? (
            <p className="mt-1.5 rounded-lg bg-tint/40 px-3 py-2 text-sm text-body">
              {request.details}
            </p>
          ) : null}
          {request.response ? (
            <p className="mt-1.5 text-sm text-muted">
              <span className="font-medium text-forest">Replied: </span>
              {request.response}
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          size="sm"
          variant={open ? "outline" : "soft"}
          onClick={() => setOpen(!open)}
        >
          {open ? "Cancel" : "Work on it"}
        </Button>
      </div>

      {open ? (
        <form onSubmit={save} className="mt-3 space-y-3 rounded-xl bg-tint/30 p-4">
          <input type="hidden" name="id" value={request.id} />

          {/* The Act does not require identity proof to accept a request, but
              handing data over — or destroying it — on an unverified say-so is
              its own breach. The reminder sits where the decision is made. */}
          <p className="flex gap-2 text-xs text-muted">
            <ShieldAlert className="size-4 shrink-0 text-warning" />
            <span>
              Ring them back on the number we already hold before releasing or
              erasing anything, and say in your reply that you did.
            </span>
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <Label htmlFor={`st-${request.id}`}>Status</Label>
              <Select
                id={`st-${request.id}`}
                name="status"
                defaultValue={request.status}
              >
                <option value="RECEIVED">Received</option>
                <option value="IN_PROGRESS">Being worked on</option>
                <option value="COMPLETED">Completed</option>
                <option value="REJECTED">Declined</option>
              </Select>
            </Field>
          </div>

          <Field>
            <Label htmlFor={`rs-${request.id}`}>What you told them</Label>
            <Textarea
              id={`rs-${request.id}`}
              name="response"
              rows={3}
              defaultValue={request.response ?? ""}
            />
            <p className="mt-1 text-xs text-muted">
              Required to close. If you kept anything back, say which and why.
            </p>
          </Field>

          <Feedback state={state} />
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </form>
      ) : (
        <Feedback state={state} />
      )}
    </li>
  );
}

export function RequestQueue({ requests }: { requests: AdminRequestRow[] }) {
  const open = requests.filter(
    (r) => r.status === "RECEIVED" || r.status === "IN_PROGRESS",
  );
  const closed = requests.filter(
    (r) => r.status === "COMPLETED" || r.status === "REJECTED",
  );

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Requests about personal data</CardTitle>
          {open.length > 0 ? (
            <Badge tone={open.some((r) => r.overdue) ? "danger" : "info"}>
              {open.length} open
            </Badge>
          ) : null}
        </div>

        {requests.length === 0 ? (
          <p className="text-sm text-muted">
            Nobody has asked for anything yet. When they do it lands here with a
            30-day clock.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-line-soft">
              {open.map((r) => (
                <RequestRow key={r.id} request={r} />
              ))}
            </ul>
            {closed.length > 0 ? (
              <details className="border-t border-line-soft pt-3">
                <summary className="cursor-pointer text-sm text-muted hover:text-forest">
                  {closed.length} closed
                </summary>
                <ul className="mt-1 divide-y divide-line-soft">
                  {closed.map((r) => (
                    <RequestRow key={r.id} request={r} />
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

export function ErasureTool() {
  const [state, setState] = useState<{ error?: string; message?: string }>({});
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardBody className="space-y-3">
        <CardTitle>Erase a store customer</CardTitle>
        <p className="text-sm text-body">
          Strips the name, email, phone and address from every order on that
          address. The order number, date and total stay, because the accounts
          need them — tell the customer that is what happened.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const email = String(
              new FormData(event.currentTarget).get("email") ?? "",
            );
            if (
              !confirm(
                `Permanently strip the personal details from every order for ${email}? This cannot be undone.`,
              )
            ) {
              return;
            }
            startTransition(async () => setState(await anonymiseCustomer(email)));
          }}
          className="space-y-3"
        >
          <Field>
            <Label htmlFor="erase-email">Their email</Label>
            <Input id="erase-email" name="email" type="email" required />
          </Field>
          <Feedback state={state} />
          <Button type="submit" variant="danger" size="sm" disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Erase
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

export function RetentionCard({
  due,
}: {
  due: { orders: number; logs: number; enquiries: number };
}) {
  const [state, setState] = useState<{ error?: string; message?: string }>({});
  const [pending, startTransition] = useTransition();
  const total = due.orders + due.logs + due.enquiries;

  return (
    <Card>
      <CardBody className="space-y-3">
        <CardTitle>Retention</CardTitle>
        <p className="text-sm text-body">
          The privacy notice publishes how long we keep things. This is what is
          now past that line.
        </p>
        <ul className="space-y-1 text-sm text-body">
          <li>
            {due.orders} order(s) past the eight-year accounting window — the
            names and addresses go, the totals stay.
          </li>
          <li>{due.enquiries} contact-form enquiry(ies) older than a year.</li>
          <li>{due.logs} security log line(s) older than a year.</li>
        </ul>
        <Feedback state={state} />
        <Button
          type="button"
          size="sm"
          variant={total > 0 ? "primary" : "soft"}
          disabled={pending || total === 0}
          onClick={() => {
            if (confirm(`Run the purge on ${total} record(s)?`)) {
              startTransition(async () => setState(await runRetentionPurge()));
            }
          }}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {total > 0 ? "Run the purge" : "Nothing due"}
        </Button>
        <p className="text-xs text-muted">
          Run by hand for now. This belongs on a nightly schedule before
          go-live — a retention period nothing enforces is a promise we are not
          keeping.
        </p>
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

export function BreachRegister({ breaches }: { breaches: BreachRow[] }) {
  const [state, setState] = useState<{ error?: string; message?: string }>({});
  const [saving, startSaving] = useTransition();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startSaving(async () => {
      const result = await recordBreach({}, data);
      setState(result);
      if (result.ok) {
        form.reset();
        setOpen(false);
      }
    });
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Breach register</CardTitle>
          <Button
            type="button"
            size="sm"
            variant={open ? "outline" : "soft"}
            onClick={() => setOpen(!open)}
          >
            {open ? "Cancel" : "Log a breach"}
          </Button>
        </div>

        <p className="text-sm text-body">
          Every personal data breach must be reported to the Data Protection
          Board within {BREACH_BOARD_HOURS} hours, and to every person affected.
          There is no size below which it can be skipped.
        </p>

        {open ? (
          <form onSubmit={save} className="space-y-3 rounded-xl bg-tint/30 p-4">
            <Field>
              <Label htmlFor="br-desc">What happened</Label>
              <Textarea id="br-desc" name="description" rows={3} required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <Label htmlFor="br-when">When you found it</Label>
                <Input id="br-when" name="detectedAt" type="datetime-local" />
              </Field>
              <Field>
                <Label htmlFor="br-count">People affected</Label>
                <Input
                  id="br-count"
                  name="affected"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  defaultValue={0}
                />
              </Field>
            </div>
            <Feedback state={state} />
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Log it
            </Button>
          </form>
        ) : (
          <Feedback state={state} />
        )}

        {breaches.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing recorded. Long may it stay that way.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {breaches.map((b) => (
              <li key={b.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-forest">
                    {b.reference}
                  </span>
                  {b.closedAt ? (
                    <Badge tone="success">Closed</Badge>
                  ) : (
                    <Badge tone="danger">Open</Badge>
                  )}
                  <span className="text-xs text-muted">
                    found {shortDate(b.detectedAt)} · {b.affected} affected
                  </span>
                </div>
                <p className="text-sm text-body">{b.description}</p>

                <div className="flex flex-wrap gap-2">
                  {b.boardNotifiedAt ? (
                    <Badge tone="success">
                      Board told {shortDate(b.boardNotifiedAt)}
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await markBreachNotified(b.id, "BOARD");
                        })
                      }
                    >
                      Mark Board notified
                    </Button>
                  )}
                  {b.principalsNotifiedAt ? (
                    <Badge tone="success">
                      People told {shortDate(b.principalsNotifiedAt)}
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await markBreachNotified(b.id, "PRINCIPALS");
                        })
                      }
                    >
                      Mark people notified
                    </Button>
                  )}
                  {!b.closedAt ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="soft"
                      disabled={pending}
                      onClick={() => {
                        const what = prompt("What was done about it?");
                        if (what) {
                          startTransition(async () =>
                            setState(await closeBreach(b.id, what)),
                          );
                        }
                      }}
                    >
                      Close
                    </Button>
                  ) : null}
                </div>

                {b.remediation ? (
                  <p className="text-xs text-muted">{b.remediation}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
