"use client";

import { useActionState, useMemo, useState } from "react";
import { Camera, Loader2, Plus, X } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  Field,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import {
  ACTIVITY_TYPES,
  CARDAMOM_GRADES,
  MATERIAL_CATEGORIES,
  UNITS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { createActivity, type ActionState } from "../../actions";

type ClientOption = {
  id: string;
  name: string;
  code: string;
  plots: { id: string; name: string }[];
};

let rowId = 0;

/**
 * Field-entry form. Jinto fills this standing in an estate on his phone, so:
 * big tap targets, camera capture, one column, and the optional detail
 * (materials, harvest, cost) only appears when it is relevant.
 */
export function ActivityForm({
  clients,
  defaultClientId,
}: {
  clients: ClientOption[];
  defaultClientId?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createActivity,
    {},
  );

  const [clientId, setClientId] = useState(defaultClientId ?? clients[0]?.id ?? "");
  const [type, setType] = useState<string>("FERTILIZER");
  const [materialRows, setMaterialRows] = useState<number[]>([rowId++]);
  const [files, setFiles] = useState<File[]>([]);

  const plots = useMemo(
    () => clients.find((c) => c.id === clientId)?.plots ?? [],
    [clientId, clients],
  );

  const showMaterials = ["FERTILIZER", "SPRAYING", "PLANTING", "OTHER"].includes(
    type,
  );
  const showHarvest = type === "HARVEST";

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-forest">Log work</h1>
        <p className="mt-1 text-sm text-muted">
          This appears on the grower&rsquo;s dashboard as soon as you save.
        </p>
      </div>

      {/* Who and where */}
      <Card>
        <CardBody className="space-y-4">
          <Field label="Client">
            <Select
              name="clientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.code}
                </option>
              ))}
            </Select>
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

          <Field label="Date">
            <Input type="date" name="date" defaultValue={today} required />
          </Field>
        </CardBody>
      </Card>

      {/* Type — chips are far easier than a dropdown on a phone */}
      <Card>
        <CardBody>
          <Label>Type of work</Label>
          <input type="hidden" name="type" value={type} />
          <div className="mt-1 flex flex-wrap gap-2">
            {ACTIVITY_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                aria-pressed={type === t.key}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm transition-colors",
                  type === t.key
                    ? "border-forest bg-forest text-cream"
                    : "border-line bg-surface text-body hover:border-moss/40",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* What happened */}
      <Card>
        <CardBody className="space-y-4">
          <Field label="Short title">
            <Input
              name="title"
              placeholder="Second round NPK application"
              required
            />
          </Field>

          <Field
            label="Notes"
            hint="What you did, what you saw, anything the grower should know."
          >
            <Textarea
              name="notes"
              rows={4}
              placeholder="Applied around the base of each clump…"
            />
          </Field>

          <Field label="Weather (optional)">
            <Input name="weather" placeholder="Cloudy, light drizzle" />
          </Field>
        </CardBody>
      </Card>

      {/* Photos — capture opens the camera directly on a phone */}
      <Card>
        <CardBody>
          <Label>Photos & videos</Label>
          <p className="mb-3 text-xs text-muted">
            Proof of the work done. Up to 25 MB per file.
          </p>

          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-cream/60 px-4 py-5 text-center hover:border-moss">
            <Camera className="size-6 text-moss" />
            <span className="text-sm font-medium text-forest">
              Take a photo or choose files
            </span>
            <span className="text-xs text-muted">
              JPG, PNG, MP4 or PDF
            </span>
            <input
              type="file"
              name="files"
              multiple
              accept="image/*,video/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </label>

          {files.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {files.map((f) => (
                <li
                  key={f.name}
                  className="flex items-center justify-between gap-2 rounded-lg bg-tint/50 px-3 py-2 text-xs"
                >
                  <span className="min-w-0 truncate text-forest">{f.name}</span>
                  <span className="shrink-0 text-muted">
                    {(f.size / 1_048_576).toFixed(1)} MB
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardBody>
      </Card>

      {/* Materials — only for the types that use them */}
      {showMaterials ? (
        <Card>
          <CardBody>
            <Label>Fertilizer / spray applied</Label>
            <p className="mb-3 text-xs text-muted">
              Recorded in the grower&rsquo;s input log.
            </p>

            <div className="space-y-3">
              {materialRows.map((id, index) => (
                <div
                  key={id}
                  className="rounded-xl border border-line-soft bg-cream/50 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">
                      Item {index + 1}
                    </span>
                    {materialRows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setMaterialRows((rows) => rows.filter((r) => r !== id))
                        }
                        className="grid size-8 place-items-center rounded-lg text-muted hover:text-danger"
                        aria-label={`Remove item ${index + 1}`}
                      >
                        <X className="size-4" />
                      </button>
                    ) : null}
                  </div>

                  <div className="space-y-2.5">
                    <Input
                      name="materialName"
                      placeholder="Factomphos 20:20:0:13"
                    />
                    <div className="grid grid-cols-2 gap-2.5">
                      <Select name="materialCategory" defaultValue="FERTILIZER">
                        {MATERIAL_CATEGORIES.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                      <Select name="materialUnit" defaultValue="kg">
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Input
                        name="materialQuantity"
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="Quantity"
                      />
                      <Input
                        name="materialCost"
                        type="number"
                        step="1"
                        inputMode="numeric"
                        placeholder="Cost ₹"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="soft"
              className="mt-3"
              onClick={() => setMaterialRows((rows) => [...rows, rowId++])}
            >
              <Plus className="size-4" /> Add another
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {/* Harvest */}
      {showHarvest ? (
        <Card>
          <CardBody className="space-y-4">
            <Label>Harvest record</Label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Green weight (kg)">
                <Input
                  name="greenWeightKg"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                />
              </Field>
              <Field label="Dried weight (kg)">
                <Input
                  name="driedWeightKg"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                />
              </Field>
            </div>
            <Field label="Grade">
              <Select name="grade" defaultValue="">
                <option value="">Not graded yet</option>
                {CARDAMOM_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Rate per kg (₹)" hint="Sale value is worked out for you.">
              <Input
                name="ratePerKg"
                type="number"
                step="1"
                inputMode="numeric"
              />
            </Field>
          </CardBody>
        </Card>
      ) : null}

      {/* Labour & cost */}
      <Card>
        <CardBody className="space-y-4">
          <Label>Labour & cost</Label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Workers">
              <Input
                name="labourCount"
                type="number"
                inputMode="numeric"
                placeholder="4"
              />
            </Field>
            <Field label="Labour cost (₹)">
              <Input
                name="labourCost"
                type="number"
                inputMode="numeric"
                placeholder="2900"
              />
            </Field>
          </div>
          <Field
            label="Other cost (₹)"
            hint="Transport, curing house fuel, machine hire."
          >
            <Input name="otherCost" type="number" inputMode="numeric" />
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

      {/* Sticky save — always reachable with a thumb */}
      <div className="sticky bottom-20 z-10 lg:bottom-4">
        <Button type="submit" size="lg" className="w-full shadow-lg" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save and publish to grower"
          )}
        </Button>
      </div>
    </form>
  );
}
