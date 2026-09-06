"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button, Card, CardBody, Field, Input, Select } from "@/components/ui";
import { WORKER_ROLES } from "@/lib/constants";
import { addWorker } from "../actions";

type ClientOption = {
  id: string;
  name: string;
  plots: { id: string; name: string }[];
};

export function AddWorkerPanel({ clients }: { clients: ClientOption[] }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (clients.length === 0) return null;

  const plots = clients.find((c) => c.id === clientId)?.plots ?? [];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await addWorker({}, data);
      if (result?.error) {
        setError(result.error);
      } else {
        setError(null);
        setOpen(false);
      }
    });
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-forest">Workers</h2>
          <Button
            type="button"
            variant={open ? "outline" : "soft"}
            size="sm"
            onClick={() => setOpen((o) => !o)}
          >
            <Plus className="size-4" /> Add worker
          </Button>
        </div>

        {open ? (
          <form
            onSubmit={submit}
            className="space-y-3 rounded-xl border border-line-soft bg-cream/60 p-4"
          >
            <Field label="Client">
              <Select
                name="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Worker name">
              <Input name="name" placeholder="Rajan K" required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Role">
                <Select name="role" defaultValue={WORKER_ROLES[0]}>
                  {WORKER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Phone">
                <Input name="phone" type="tel" inputMode="tel" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Daily wage (₹)">
                <Input name="dailyWage" type="number" inputMode="numeric" />
              </Field>
              {plots.length > 0 ? (
                <Field label="Estate">
                  <Select name="plotId" defaultValue="">
                    <option value="">Any estate</option>
                    {plots.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Add worker
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}
