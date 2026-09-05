"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button, Field, Input, Label, Select } from "@/components/ui";
import { WORKER_ROLES } from "@/lib/constants";
import {
  removePlot,
  removeWorker,
  restorePlot,
  restoreWorker,
  updatePlot,
  updateWorker,
} from "../../actions";

type Plot = {
  id: string;
  name: string;
  location: string | null;
  areaAcres: number | null;
  plants: number | null;
  isActive: boolean;
  activityCount: number;
};

type Worker = {
  id: string;
  name: string;
  phone: string | null;
  role: string | null;
  plotId: string | null;
  dailyWage: number | null;
  isActive: boolean;
  daysLogged: number;
};

/* -------------------------------------------------------------------------- */

function RowShell({
  archived,
  children,
  controls,
}: {
  archived: boolean;
  children: React.ReactNode;
  controls: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 px-4 py-3 sm:px-5 ${
        archived ? "bg-cream-deep/50" : ""
      }`}
    >
      <div className="min-w-0">{children}</div>
      <div className="flex shrink-0 items-center gap-1">{controls}</div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  danger = false,
  busy = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className={`grid size-11 place-items-center rounded-lg transition-colors disabled:opacity-50 ${
        danger
          ? "text-danger hover:bg-danger/10"
          : "text-muted hover:bg-tint hover:text-forest"
      }`}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Estate                                                                     */
/* -------------------------------------------------------------------------- */

export function PlotRow({ plot }: { plot: Plot }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Submitting from a handler (rather than useActionState) lets the editor
  // close on success without a setState-inside-effect round trip.
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSaving(async () => {
      const result = await updatePlot({}, data);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEditing(false);
      }
    });
  }

  if (editing) {
    return (
      <form onSubmit={save} className="space-y-3 px-4 py-4 sm:px-5">
        <input type="hidden" name="id" value={plot.id} />
        <Field>
          <Label htmlFor={`p-name-${plot.id}`}>Estate name</Label>
          <Input id={`p-name-${plot.id}`} name="name" defaultValue={plot.name} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field>
            <Label htmlFor={`p-loc-${plot.id}`}>Location</Label>
            <Input
              id={`p-loc-${plot.id}`}
              name="location"
              defaultValue={plot.location ?? ""}
            />
          </Field>
          <Field>
            <Label htmlFor={`p-acr-${plot.id}`}>Acres</Label>
            <Input
              id={`p-acr-${plot.id}`}
              name="areaAcres"
              type="number"
              step="0.01"
              inputMode="decimal"
              defaultValue={plot.areaAcres ?? ""}
            />
          </Field>
          <Field>
            <Label htmlFor={`p-pl-${plot.id}`}>Plants</Label>
            <Input
              id={`p-pl-${plot.id}`}
              name="plants"
              type="number"
              inputMode="numeric"
              defaultValue={plot.plants ?? ""}
            />
          </Field>
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
          <Button type="button" variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  const detail =
    [
      plot.location,
      plot.areaAcres ? `${plot.areaAcres} acres` : null,
      plot.plants ? `${plot.plants.toLocaleString("en-IN")} plants` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "No details yet";

  return (
    <RowShell
      archived={!plot.isActive}
      controls={
        plot.isActive ? (
          <>
            <IconButton label="Edit estate" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
            </IconButton>
            <IconButton
              label={
                plot.activityCount > 0
                  ? "Archive estate (work history is kept)"
                  : "Remove estate"
              }
              danger
              busy={pending}
              onClick={() => {
                const msg =
                  plot.activityCount > 0
                    ? `${plot.name} has ${plot.activityCount} logged ${
                        plot.activityCount === 1 ? "entry" : "entries"
                      }. It will be archived, not deleted, so that history stays intact. Continue?`
                    : `Remove ${plot.name}? Nothing has been logged against it.`;
                if (confirm(msg)) {
                  startTransition(() => {
                    void removePlot(plot.id);
                  });
                }
              }}
            >
              <Trash2 className="size-4" />
            </IconButton>
          </>
        ) : (
          <IconButton
            label="Restore estate"
            busy={pending}
            onClick={() =>
              startTransition(() => {
                void restorePlot(plot.id);
              })
            }
          >
            <RotateCcw className="size-4" />
          </IconButton>
        )
      }
    >
      <p className="truncate text-sm font-medium text-forest">
        {plot.name}
        {!plot.isActive ? (
          <span className="ms-2 rounded-full bg-line px-2 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted">
            Archived
          </span>
        ) : null}
      </p>
      <p className="mt-0.5 text-xs text-muted">{detail}</p>
    </RowShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Worker                                                                     */
/* -------------------------------------------------------------------------- */

export function WorkerRow({
  worker,
  plots,
}: {
  worker: Worker;
  plots: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSaving(async () => {
      const result = await updateWorker({}, data);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEditing(false);
      }
    });
  }

  if (editing) {
    return (
      <form onSubmit={save} className="space-y-3 px-4 py-4 sm:px-5">
        <input type="hidden" name="id" value={worker.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <Label htmlFor={`w-name-${worker.id}`}>Name</Label>
            <Input
              id={`w-name-${worker.id}`}
              name="name"
              defaultValue={worker.name}
              required
            />
          </Field>
          <Field>
            <Label htmlFor={`w-ph-${worker.id}`}>Phone</Label>
            <Input
              id={`w-ph-${worker.id}`}
              name="phone"
              inputMode="tel"
              defaultValue={worker.phone ?? ""}
            />
          </Field>
          <Field>
            <Label htmlFor={`w-role-${worker.id}`}>Role</Label>
            <Select
              id={`w-role-${worker.id}`}
              name="role"
              defaultValue={worker.role ?? ""}
            >
              <option value="">Not set</option>
              {WORKER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label htmlFor={`w-wage-${worker.id}`}>Daily wage (₹)</Label>
            <Input
              id={`w-wage-${worker.id}`}
              name="dailyWage"
              type="number"
              inputMode="numeric"
              defaultValue={worker.dailyWage ?? ""}
            />
          </Field>
        </div>
        <Field>
          <Label htmlFor={`w-plot-${worker.id}`}>Usually works on</Label>
          <Select
            id={`w-plot-${worker.id}`}
            name="plotId"
            defaultValue={worker.plotId ?? ""}
          >
            <option value="">Any estate</option>
            {plots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
          <Button type="button" variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <RowShell
      archived={!worker.isActive}
      controls={
        worker.isActive ? (
          <>
            {worker.dailyWage ? (
              <span className="me-1 hidden text-sm text-body sm:inline">
                ₹{worker.dailyWage.toLocaleString("en-IN")}/day
              </span>
            ) : null}
            <IconButton label="Edit worker" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
            </IconButton>
            <IconButton
              label={
                worker.daysLogged > 0
                  ? "Archive worker (recorded days are kept)"
                  : "Remove worker"
              }
              danger
              busy={pending}
              onClick={() => {
                const msg =
                  worker.daysLogged > 0
                    ? `${worker.name} appears in ${worker.daysLogged} logged ${
                        worker.daysLogged === 1 ? "day" : "days"
                      } of work. They will be archived, not deleted, so the record the grower sees stays accurate. Continue?`
                    : `Remove ${worker.name}? They have no recorded work.`;
                if (confirm(msg)) {
                  startTransition(() => {
                    void removeWorker(worker.id);
                  });
                }
              }}
            >
              <Trash2 className="size-4" />
            </IconButton>
          </>
        ) : (
          <IconButton
            label="Restore worker"
            busy={pending}
            onClick={() =>
              startTransition(() => {
                void restoreWorker(worker.id);
              })
            }
          >
            <RotateCcw className="size-4" />
          </IconButton>
        )
      }
    >
      <p className="truncate text-sm font-medium text-forest">
        {worker.name}
        {!worker.isActive ? (
          <span className="ms-2 rounded-full bg-line px-2 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted">
            Archived
          </span>
        ) : null}
      </p>
      <p className="text-xs text-muted">
        {[worker.role, worker.phone].filter(Boolean).join(" · ") || "No details"}
      </p>
    </RowShell>
  );
}
