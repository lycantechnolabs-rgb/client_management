"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2, Plus, UserX } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  Field,
  Input,
  Select,
  SectionHeading,
} from "@/components/ui";
import { WORKER_ROLES } from "@/lib/constants";
import { addPlot, addWorker, resetClientPassword, toggleClientActive } from "../../actions";

export function ClientAdminActions({
  clientId,
  isActive,
  loginEmail,
  lastLoginAt,
  mustChangePassword,
  plots,
}: {
  clientId: string;
  isActive: boolean;
  loginEmail?: string;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  plots: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [panel, setPanel] = useState<"plot" | "worker" | null>(null);

  return (
    <Card>
      <CardBody className="space-y-4">
        <SectionHeading title="Account" />

        <div className="space-y-1 text-sm">
          <p className="text-muted">
            Login:{" "}
            <span className="text-body">{loginEmail ?? "none"}</span>
          </p>
          <p className="text-muted">
            Last signed in:{" "}
            <span className="text-body">{lastLoginAt ?? "never"}</span>
          </p>
          {mustChangePassword ? (
            <p className="text-warning">
              Still using a temporary password.
            </p>
          ) : null}
        </div>

        {tempPassword ? (
          <div className="rounded-xl bg-success/8 px-4 py-3">
            <p className="text-sm text-success">New temporary password:</p>
            <p className="mt-1 font-mono text-lg text-forest">{tempPassword}</p>
            <p className="mt-1 text-xs text-muted">
              Pass it on over WhatsApp. Shown only once.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await resetClientPassword(clientId);
                if (result?.message) setTempPassword(result.message);
              })
            }
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            Reset password
          </Button>

          <Button
            type="button"
            variant={isActive ? "outline" : "primary"}
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await toggleClientActive(clientId, !isActive);
              })
            }
          >
            <UserX className="size-4" />
            {isActive ? "Deactivate" : "Reactivate"}
          </Button>

          <Button
            type="button"
            variant="soft"
            size="sm"
            onClick={() => setPanel(panel === "plot" ? null : "plot")}
          >
            <Plus className="size-4" /> Add estate
          </Button>

          <Button
            type="button"
            variant="soft"
            size="sm"
            onClick={() => setPanel(panel === "worker" ? null : "worker")}
          >
            <Plus className="size-4" /> Add worker
          </Button>
        </div>

        {panel === "plot" ? (
          <form
            action={async (formData) => {
              await addPlot({}, formData);
              setPanel(null);
            }}
            className="space-y-3 rounded-xl border border-line-soft bg-cream/60 p-4"
          >
            <input type="hidden" name="clientId" value={clientId} />
            <Field label="Estate name">
              <Input name="name" placeholder="Hill View Plot" required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Location">
                <Input name="location" />
              </Field>
              <Field label="Acres">
                <Input name="areaAcres" type="number" step="0.1" inputMode="decimal" />
              </Field>
              <Field label="Plants">
                <Input name="plants" type="number" inputMode="numeric" />
              </Field>
            </div>
            <Button type="submit" size="sm">
              Add estate
            </Button>
          </form>
        ) : null}

        {panel === "worker" ? (
          <form
            action={async (formData) => {
              await addWorker({}, formData);
              setPanel(null);
            }}
            className="space-y-3 rounded-xl border border-line-soft bg-cream/60 p-4"
          >
            <input type="hidden" name="clientId" value={clientId} />
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
                  <Select name="plotId" defaultValue={plots[0]?.id}>
                    {plots.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </div>
            <Button type="submit" size="sm">
              Add worker
            </Button>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}
