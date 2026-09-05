"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { prepareFiles } from "@/lib/compress-image";
import type { CommonMaterial } from "@/lib/common-materials";
import { Camera, ImagePlus, Loader2, Plus, X } from "lucide-react";
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
import { MalayalamFields } from "@/components/malayalam-fields";

type WorkerOption = {
  id: string;
  name: string;
  role: string | null;
  dailyWage: number | null;
};

type ClientOption = {
  id: string;
  name: string;
  code: string;
  plots: { id: string; name: string }[];
  workers: WorkerOption[];
};

let rowId = 0;

type MaterialRow = {
  id: number;
  name: string;
  /** Primary first; the rest are stored as extras. */
  categories: string[];
  unit: string;
};

type GradeRow = {
  id: number;
  grade: string;
  driedKg: string;
  ratePerKg: string;
};

const blankGrade = (): GradeRow => ({
  id: rowId++,
  grade: "",
  driedKg: "",
  ratePerKg: "",
});

const blankRow = (): MaterialRow => ({
  id: rowId++,
  name: "",
  categories: ["FERTILIZER"],
  unit: "kg",
});

/**
 * Field-entry form. Jinto fills this standing in an estate on his phone, so:
 * big tap targets, camera capture, one column, and the optional detail
 * (materials, harvest, cost) only appears when it is relevant.
 */
export function ActivityForm({
  clients,
  defaultClientId,
  common,
}: {
  clients: ClientOption[];
  defaultClientId?: string;
  /** Inputs already used on this book, most-used first. May be empty. */
  common: CommonMaterial[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createActivity,
    {},
  );

  /**
   * The save is dispatched inside an explicit transition.
   *
   * Passing an async function to `action` puts *that function* in a transition,
   * but the photo compression below is awaited first — so by the time
   * `formAction` is called the transition has already ended, and React warns
   * that the dispatch escaped it, cautioning that `isPending` may not update.
   *
   * Measured before changing it, with the action artificially slowed: the
   * button *did* still disable itself, so the busy state was not visibly
   * broken here. What React is warning about is that the behaviour is not
   * guaranteed — it depends on the dispatch still being associated with a
   * transition React has not finished, which is incidental rather than
   * promised, and is exactly the sort of thing that changes between releases.
   *
   * `useTransition` makes it explicit: the pending flag tracks this dispatch
   * wherever it is called from, so the Save button's disabled state rests on a
   * documented guarantee instead of a coincidence.
   */
  const [saving, startTransition] = useTransition();

  const [clientId, setClientId] = useState(defaultClientId ?? clients[0]?.id ?? "");
  // A visit is often more than one kind of work — weeding and fertilizer on
  // the same walk. Splitting that into two entries divides the costs and the
  // photographs of one visit across two rows on the grower's dashboard.
  const [types, setTypes] = useState<string[]>(["FERTILIZER"]);
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([blankRow()]);

  const patchRow = (id: number, patch: Partial<MaterialRow>) =>
    setMaterialRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );

  /** Removing the last row leaves a blank one, so there is always somewhere to type. */
  const removeRow = (id: number) =>
    setMaterialRows((rows) => {
      const left = rows.filter((r) => r.id !== id);
      return left.length > 0 ? left : [blankRow()];
    });

  const toggleCategory = (id: number, key: string) =>
    setMaterialRows((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        if (!r.categories.includes(key)) return { ...r, categories: [...r.categories, key] };
        // Never empty: the last category stays rather than leaving the server
        // to guess what the material was.
        if (r.categories.length === 1) return r;
        return { ...r, categories: r.categories.filter((c) => c !== key) };
      }),
    );

  /**
   * Tapping a suggestion adds a named row; tapping it again takes it away.
   *
   * A blank first row is reused rather than left dangling above the new one —
   * otherwise the common case of "open the form, tap two inputs" leaves an
   * empty row at the top that the action silently drops and Jinto has to
   * wonder about.
   */
  const toggleCommon = (m: CommonMaterial) =>
    setMaterialRows((rows) => {
      const match = rows.find(
        (r) => r.name.toLowerCase() === m.name.toLowerCase(),
      );
      if (match) {
        const left = rows.filter((r) => r.id !== match.id);
        return left.length > 0 ? left : [blankRow()];
      }
      const added: MaterialRow = {
        id: rowId++,
        name: m.name,
        categories: [m.category],
        unit: m.unit,
      };
      const blankIndex = rows.findIndex((r) => r.name.trim() === "");
      if (blankIndex === -1) return [...rows, added];
      return rows.map((r, i) => (i === blankIndex ? added : r));
    });
  const [files, setFiles] = useState<File[]>([]);

  /**
   * Add to the list rather than replace it.
   *
   * Two pickers now feed the same list, and each is cleared after use so it can
   * be opened again — so a straight assignment would throw away everything
   * chosen before. Duplicates are dropped on name and size, which is what
   * happens when the same photo is picked twice from the gallery.
   */
  const addFiles = (incoming: File[]) =>
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...incoming.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  const [preparing, setPreparing] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const plots = useMemo(
    () => clients.find((c) => c.id === clientId)?.plots ?? [],
    [clientId, clients],
  );

  const workers = useMemo(
    () => clients.find((c) => c.id === clientId)?.workers ?? [],
    [clientId, clients],
  );

  /**
   * Who was on the estate that day.
   *
   * Kept as a set of ids, and cleared whenever the client changes — a worker
   * belongs to one estate, so a selection carried across would attach Thomas's
   * crew to Rajan's visit. The server refuses that anyway; clearing it here
   * means Jinto never sees names that are not his to pick.
   */
  const [workerIds, setWorkerIds] = useState<string[]>([]);

  /**
   * Which blocks the visit covered.
   *
   * Starts on the first block, which is what the old single select did, so the
   * common case of one block is still one tap of nothing. Emptying it is
   * allowed: work on the whole estate, or an office job, belongs to no block in
   * particular and the schema has always let plotId be null.
   */
  /**
   * The lots this picking was graded into.
   *
   * Rows rather than chips because a grade carries a weight and a rate — a
   * picking is 40 kg of extra bold at one price and 25 of bold at another. A
   * plain multi-select would record which grades were made and lose how much of
   * each, which is the only part the season report needs.
   */
  const [gradeRows, setGradeRows] = useState<GradeRow[]>([blankGrade()]);

  const patchGrade = (id: number, patch: Partial<GradeRow>) =>
    setGradeRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeGrade = (id: number) =>
    setGradeRows((rows) => {
      const left = rows.filter((r) => r.id !== id);
      return left.length > 0 ? left : [blankGrade()];
    });

  /** What the rows come to, shown live so the arithmetic is never a surprise. */
  const gradeTotals = gradeRows.reduce(
    (acc, r) => {
      const kg = Number(r.driedKg);
      const rate = Number(r.ratePerKg);
      if (!r.grade || !Number.isFinite(kg) || kg <= 0) return acc;
      acc.kg += kg;
      if (r.ratePerKg !== "" && Number.isFinite(rate)) acc.value += kg * rate;
      return acc;
    },
    { kg: 0, value: 0 },
  );

  /** Grades already claimed, so the same lot cannot be entered twice. */
  const usedGrades = new Set(gradeRows.map((r) => r.grade).filter(Boolean));

  const [plotIds, setPlotIds] = useState<string[]>(() => {
    const startingClient = defaultClientId ?? clients[0]?.id;
    const first = clients.find((c) => c.id === startingClient)?.plots[0]?.id;
    return first ? [first] : [];
  });

  const togglePlot = (id: string) =>
    setPlotIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );

  const toggleWorker = (id: string) =>
    setWorkerIds((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id],
    );

  const chosenWorkers = workers.filter((w) => workerIds.includes(w.id));

  /**
   * What the selected crew comes to at their daily wage.
   *
   * Offered, never imposed: the cost field stays editable and empty by default,
   * because a day is not always a full day and Jinto is the one who knows. A
   * worker with no wage on record contributes nothing here rather than a zero
   * that would quietly understate the total.
   */
  const suggestedLabour = chosenWorkers.reduce(
    (sum, w) => sum + (w.dailyWage ?? 0),
    0,
  );
  const missingWage = chosenWorkers.filter((w) => w.dailyWage == null).length;

  // Any selected kind can bring its section in: a visit that was both weeding
  // and harvest needs the harvest fields, whichever was picked first.
  const showMaterials = types.some((t) =>
    ["FERTILIZER", "SPRAYING", "PLANTING", "OTHER"].includes(t),
  );
  const showHarvest = types.includes("HARVEST");

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      action={async (formData) => {
        // Same reason as the grower's form: a phone photograph is several
        // megabytes, a Server Action body is capped well below that, and the
        // cap is enforced before the action runs. Shrink first, and say so
        // here rather than letting Jinto meet a runtime error in a field.
        // From state, not from the form: the two pickers are cleared after
        // each use so they can be reopened, so neither holds the full list.
        const chosen = files.filter((f) => f.size > 0);

        if (chosen.length > 0) {
          setPreparing(true);
          const prepared = await prepareFiles(chosen);
          setPreparing(false);

          if (prepared.error) {
            setSizeError(prepared.error);
            return;
          }
          setSizeError(null);

          formData.delete("files");
          for (const file of prepared.files) formData.append("files", file);
        }

        startTransition(() => {
          formAction(formData);
        });
      }}
      className="space-y-5"
    >
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
              onChange={(e) => {
                const next = e.target.value;
                setClientId(next);
                // Neither their crew nor their blocks are this client's.
                setWorkerIds([]);
                setPlotIds(
                  clients.find((c) => c.id === next)?.plots[0]?.id
                    ? [clients.find((c) => c.id === next)!.plots[0].id]
                    : [],
                );
              }}
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
            <Field
              label="Blocks"
              hint="A round that crossed a boundary counts for both."
            >
              {/*
                Multi-select, because a walk rarely stops at a block boundary.
                This is not cosmetic: the round board computes each block's
                45-day picking cycle from the visits that touched it, so a spray
                round recorded against one block only would leave the other
                showing overdue the day after it was worked.
              */}
              {plotIds.map((id) => (
                <input key={id} type="hidden" name="plotId" value={id} />
              ))}
              <div className="mt-1 flex flex-wrap gap-2">
                {plots.map((p) => {
                  const on = plotIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => togglePlot(p.id)}
                      className={cn(
                        "min-h-11 rounded-full border px-4 text-sm transition-colors",
                        on
                          ? "border-forest bg-forest text-cream"
                          : "border-line bg-surface text-body hover:border-moss/40",
                      )}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
              {plotIds.length === 0 ? (
                <p className="mt-2 text-xs text-muted">
                  None chosen — this will be filed against the estate as a whole.
                </p>
              ) : null}
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
          <p className="mt-0.5 text-xs text-muted">
            Pick every kind of work done on this visit.
          </p>
          {/*
            One hidden input per selection. The action reads them with
            getAll("type"), so the wire format is a plain repeated field and
            needs no encoding of its own.
          */}
          {types.map((t) => (
            <input key={t} type="hidden" name="type" value={t} />
          ))}
          <div className="mt-2 flex flex-wrap gap-2">
            {ACTIVITY_TYPES.map((t) => {
              const on = types.includes(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() =>
                    setTypes((prev) =>
                      prev.includes(t.key)
                        ? // Never empty: the last one stays on rather than
                          // leaving the entry with no kind at all, which the
                          // server would have to guess at.
                          prev.length === 1
                          ? prev
                          : prev.filter((k) => k !== t.key)
                        : [...prev, t.key],
                    )
                  }
                  aria-pressed={on}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-sm transition-colors",
                    on
                      ? "border-forest bg-forest text-cream"
                      : "border-line bg-surface text-body hover:border-moss/40",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
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

          {/*
            The Malayalam, for growers who read only Malayalam.
            Beside the English rather than on a separate screen, because a
            translation written later is a translation never written — and
            these two boxes are the only thing standing between those growers
            and a page of English about their own estate.
          */}
          <MalayalamFields />

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

          {/*
            Two pickers, not one, and this is the whole reason multi-select did
            not work before.

            `capture` is not a hint — on a phone it *replaces* the file picker
            with the camera. Combined with `multiple` on one input, the browser
            honours capture and ignores multiple: you get the camera and exactly
            one photo, with no way to reach the gallery. Splitting them keeps
            one-tap capture for standing in the estate and gives a real
            multi-select picker for everything already on the phone.
          */}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-cream/60 px-4 py-5 text-center hover:border-moss">
              <Camera className="size-6 text-moss" />
              <span className="text-sm font-medium text-forest">Take a photo</span>
              <span className="text-xs text-muted">Opens the camera</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                // Appends rather than replaces: taking a second photo must not
                // discard the first, which is what a plain assignment did.
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            </label>

            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-cream/60 px-4 py-5 text-center hover:border-moss">
              <ImagePlus className="size-6 text-moss" />
              <span className="text-sm font-medium text-forest">
                Choose from gallery
              </span>
              <span className="text-xs text-muted">
                Photos, video or PDF — pick several
              </span>
              <input
                type="file"
                multiple
                accept="image/*,video/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            </label>
          </div>



          {files.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${f.size}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-tint/50 py-1 pe-1 ps-3 text-xs"
                >
                  <span className="min-w-0 truncate text-forest">{f.name}</span>
                  <span className="ms-auto shrink-0 text-muted">
                    {(f.size / 1_048_576).toFixed(1)} MB
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setFiles((prev) => prev.filter((_, n) => n !== i))}
                    className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                  >
                    <X className="size-4" />
                  </button>
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

            {/*
              The inputs already used on this book, most-used first. Tapping
              three of them creates three named rows in one go — the everyday
              case, where the work is typing quantities rather than product
              names. A hard-coded list would start out wrong for this estate and
              drift every season; this one comes from what has actually been
              logged. See src/lib/common-materials.ts.
            */}
            {common.length > 0 ? (
              <div className="mb-4">
                <p className="mb-2 text-xs text-muted">
                  Tap what you used — or fill the rows in by hand.
                </p>
                <div className="flex flex-wrap gap-2">
                  {common.map((m) => {
                    const on = materialRows.some(
                      (r) => r.name.toLowerCase() === m.name.toLowerCase(),
                    );
                    return (
                      <button
                        key={m.name}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleCommon(m)}
                        className={cn(
                          "min-h-11 rounded-full border px-4 text-sm transition-colors",
                          on
                            ? "border-forest bg-forest text-cream"
                            : "border-line bg-surface text-body hover:border-moss/40",
                        )}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              {materialRows.map((row, index) => (
                <div
                  key={row.id}
                  className="rounded-xl border border-line-soft bg-cream/50 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">
                      Item {index + 1}
                    </span>
                    {/*
                      Always offered, and 44px like every other control here.
                      It used to be 32px and to disappear when one row was left,
                      so the only way to clear a row typed by mistake was to
                      empty three fields by hand.
                    */}
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      // shrink-0: as a flex item it was collapsing to the width
                      // of its icon — 44px tall but 16px wide, which is not a
                      // 44px target in the direction a thumb misses.
                      className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                      aria-label={`Remove item ${index + 1}`}
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    <Input
                      name="materialName"
                      value={row.name}
                      onChange={(e) => patchRow(row.id, { name: e.target.value })}
                      placeholder="Factomphos 20:20:0:13"
                    />

                    {/*
                      Categories are chips, not a select, because a material can
                      be more than one thing — a drench that is both a fungicide
                      and a growth promoter. One hidden field per row carries
                      them, joined, so the parallel arrays the action reads stay
                      aligned row for row.
                    */}
                    <input
                      type="hidden"
                      name="materialCategory"
                      value={row.categories.join(",")}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {MATERIAL_CATEGORIES.map((c) => {
                        const on = row.categories.includes(c.key);
                        return (
                          <button
                            key={c.key}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleCategory(row.id, c.key)}
                            className={cn(
                              "min-h-11 rounded-full border px-3 text-xs transition-colors",
                              on
                                ? "border-moss bg-moss/15 text-forest"
                                : "border-line bg-surface text-muted hover:border-moss/40",
                            )}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <Input
                        name="materialQuantity"
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="Quantity"
                      />
                      <Select
                        name="materialUnit"
                        value={row.unit}
                        onChange={(e) => patchRow(row.id, { unit: e.target.value })}
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Input
                      name="materialCost"
                      type="number"
                      step="1"
                      inputMode="numeric"
                      placeholder="Cost ₹"
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="soft"
              className="mt-3"
              onClick={() => setMaterialRows((rows) => [...rows, blankRow()])}
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
              <Field
                label="Dried weight (kg)"
                hint={
                  gradeTotals.kg > 0
                    ? "Added up from the lots below."
                    : "Or record it per grade below."
                }
              >
                <Input
                  name="driedWeightKg"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  // Reflects the lots but stays typable for a round weighed
                  // before it was graded. The server prefers the lots when
                  // there are any, so the two cannot disagree.
                  key={`dried-${gradeTotals.kg}`}
                  defaultValue={gradeTotals.kg || ""}
                  readOnly={gradeTotals.kg > 0}
                />
              </Field>
            </div>
            {/*
              One row per graded lot.
              
              A picking is sorted into extra bold, bold and superior, each with
              its own weight and its own rate — extra bold fetches noticeably
              more. Recorded as one grade with one weight, the season's grade
              breakdown puts every kilogram under whichever grade was chosen,
              which is not slightly wrong but wholly so.
            */}
            <div>
              <Label>Graded into</Label>
              <p className="mb-2 mt-0.5 text-xs text-muted">
                A lot per grade. Leave it empty if the round is not graded yet.
              </p>

              <div className="space-y-3">
                {gradeRows.map((row, index) => {
                  const kg = Number(row.driedKg);
                  const rate = Number(row.ratePerKg);
                  const value =
                    row.grade && Number.isFinite(kg) && kg > 0 &&
                    row.ratePerKg !== "" && Number.isFinite(rate)
                      ? kg * rate
                      : null;
                  return (
                    <div
                      key={row.id}
                      className="rounded-xl border border-line-soft bg-cream/50 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-muted">
                          Lot {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeGrade(row.id)}
                          className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                          aria-label={`Remove lot ${index + 1}`}
                        >
                          <X className="size-4" />
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        <Select
                          name="gradeName"
                          value={row.grade}
                          onChange={(e) => patchGrade(row.id, { grade: e.target.value })}
                        >
                          <option value="">Choose a grade</option>
                          {CARDAMOM_GRADES.map((g) => (
                            <option
                              key={g}
                              value={g}
                              // A grade already claimed by another lot: two rows
                              // of the same grade would be two truths about one
                              // weight, and the unique index refuses it anyway.
                              disabled={g !== row.grade && usedGrades.has(g)}
                            >
                              {g}
                            </option>
                          ))}
                        </Select>
                        <div className="grid grid-cols-2 gap-2.5">
                          <Input
                            name="gradeDriedKg"
                            type="number"
                            step="0.1"
                            inputMode="decimal"
                            placeholder="Dried kg"
                            value={row.driedKg}
                            onChange={(e) => patchGrade(row.id, { driedKg: e.target.value })}
                          />
                          <Input
                            name="gradeRate"
                            type="number"
                            step="1"
                            inputMode="numeric"
                            placeholder="Rate ₹/kg"
                            value={row.ratePerKg}
                            onChange={(e) => patchGrade(row.id, { ratePerKg: e.target.value })}
                          />
                        </div>
                        {value != null ? (
                          <p className="text-xs text-muted">
                            = ₹{Math.round(value).toLocaleString("en-IN")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="soft"
                className="mt-3"
                onClick={() => setGradeRows((rows) => [...rows, blankGrade()])}
              >
                <Plus className="size-4" /> Add a grade
              </Button>

              {gradeTotals.kg > 0 ? (
                <p className="mt-3 rounded-lg bg-tint/50 px-3 py-2 text-sm text-forest">
                  {gradeTotals.kg.toLocaleString("en-IN")} kg dried
                  {gradeTotals.value > 0 ? (
                    <> · ₹{Math.round(gradeTotals.value).toLocaleString("en-IN")}</>
                  ) : null}
                  <span className="ms-1 text-xs text-muted">
                    — this is what the round records
                  </span>
                </p>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Labour & cost */}
      <Card>
        <CardBody className="space-y-4">
          <Label>Labour & cost</Label>

          {/*
            Who was there, by name.
            
            The form only ever asked "how many", so ActivityWorker rows existed
            in the schema and on both detail pages but nothing could create one —
            the grower could see a count and never who did the work. These are
            this client's active workers, and the list changes with the client.
          */}
          {workers.length > 0 ? (
            <Field label="Who worked">
              {workerIds.map((id) => (
                <input key={id} type="hidden" name="workerId" value={id} />
              ))}
              <div className="mt-1 flex flex-wrap gap-2">
                {workers.map((w) => {
                  const on = workerIds.includes(w.id);
                  return (
                    <button
                      key={w.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleWorker(w.id)}
                      className={cn(
                        "min-h-11 rounded-full border px-4 text-sm transition-colors",
                        on
                          ? "border-forest bg-forest text-cream"
                          : "border-line bg-surface text-body hover:border-moss/40",
                      )}
                    >
                      {w.name}
                      {w.role ? (
                        <span className={cn("ms-1.5 text-xs", on ? "text-cream/70" : "text-muted")}>
                          {w.role}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {chosenWorkers.length > 0 ? (
                <p className="mt-2 text-xs text-muted">
                  {chosenWorkers.length}{" "}
                  {chosenWorkers.length === 1 ? "person" : "people"}
                  {suggestedLabour > 0 ? (
                    <>
                      {" · "}a day at their usual wage comes to ₹
                      {suggestedLabour.toLocaleString("en-IN")}
                      {missingWage > 0
                        ? ` (${missingWage} with no wage on record)`
                        : ""}
                    </>
                  ) : null}
                </p>
              ) : null}
            </Field>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Workers"
              hint={
                workers.length > 0
                  ? "Filled from the names above; change it for anyone not on the list."
                  : undefined
              }
            >
              <Input
                name="labourCount"
                type="number"
                inputMode="numeric"
                placeholder="4"
                // Reflects the chosen names but stays editable: casual hands who
                // are not on the payroll still need counting.
                key={`labour-${chosenWorkers.length}`}
                defaultValue={chosenWorkers.length || ""}
              />
            </Field>
            <Field label="Labour cost (₹)">
              <Input
                name="labourCost"
                type="number"
                inputMode="numeric"
                placeholder={
                  suggestedLabour > 0
                    ? String(Math.round(suggestedLabour))
                    : "2900"
                }
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

      {sizeError ? (
        <p
          role="alert"
          className="rounded-lg bg-danger/8 px-3 py-2 text-sm text-danger"
        >
          {sizeError}
        </p>
      ) : null}

      {/* Sticky save — always reachable with a thumb */}
      <div className="sticky bottom-20 z-10 lg:bottom-4">
        <Button
          type="submit"
          size="lg"
          className="w-full shadow-lg"
          disabled={saving || preparing}
        >
          {preparing ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Preparing photos…
            </>
          ) : saving ? (
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
