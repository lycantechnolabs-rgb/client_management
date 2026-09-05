"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  Field,
  Input,
  Label,
  Select,
} from "@/components/ui";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { uploadFiles, type UploadOutcome } from "@/lib/direct-upload";
import {
  ACCEPT,
  ACCEPT_MEDIA,
  formatBytes,
  type UploadLimits,
} from "@/lib/upload-limits";
import { deleteOwnUpload } from "./actions";

/**
 * The grower's own upload control.
 *
 * Collapsed to a single button until they want it. The portal's main job is
 * showing a grower what was done on their estate; adding their own file is the
 * occasional case, and an always-open form would push the actual content down
 * the phone screen where most of them read it.
 *
 * Files go straight from here to storage rather than through a Server Action —
 * see src/lib/direct-upload.ts. That is what makes a two-minute estate video
 * possible at all, and it is why this is a plain form with its own submit
 * handler rather than a `useActionState` one: the work happens in the browser,
 * a file at a time, with progress.
 */
export type UploadWords = {
  open: string;
  /** The document categories, already in the reader's language. */
  categories?: { key: string; label: string }[];
  chooseLabel: string;
  caption: string;
  captionHint: string;
  whatIsIt: string;
  send: string;
  sending: string;
  cancel: string;
  added: string;
  oneAtATime: string;
};

export function UploadForm({
  target,
  canUpload,
  limits,
  w,
}: {
  /** The words, passed in — this is a client component. */
  w: UploadWords;
  target: "media" | "document";
  /** False when the admin has withdrawn the permission — the form stays shut. */
  canUpload: boolean;
  /**
   * The ceilings this deployment can actually honour, from uploadCapacity().
   * Passed in rather than imported because they depend on how storage is
   * configured, and a number printed here that the server would refuse is
   * worse than no number at all.
   */
  limits: UploadLimits;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{
    file: string;
    percent: number;
  } | null>(null);
  const [failures, setFailures] = useState<UploadOutcome[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  if (!canUpload) return null;

  const accept = target === "media" ? ACCEPT_MEDIA : ACCEPT.DOCUMENT;

  const limitNote =
    target === "media"
      ? `Photos up to ${formatBytes(limits.IMAGE)}, video up to ${formatBytes(limits.VIDEO)}.`
      : `PDF up to ${formatBytes(limits.DOCUMENT)}.`;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const chosen = data
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (chosen.length === 0) return;

    setBusy(true);
    setFailures([]);
    setDone(null);

    const outcomes = await uploadFiles(
      chosen,
      {
        caption: String(data.get("caption") ?? ""),
        category: String(data.get("category") ?? "OTHER"),
      },
      setProgress,
    );

    setBusy(false);
    setProgress(null);
    setFailures(outcomes.filter((o) => !o.ok));

    const added = outcomes.filter((o) => o.ok).length;
    if (added > 0) {
      setDone(w.added);
      form.reset();
      // Only close when everything worked; a failure needs to stay on screen.
      if (outcomes.every((o) => o.ok)) setOpen(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="soft" onClick={() => setOpen(true)}>
          <Upload className="size-4" />
          {w.open}
        </Button>
        {done ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-moss">
            <CheckCircle2 className="size-4" />
            {done}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <Card variant="glass">
      <CardBody>
        <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
          <Field>
            <Label htmlFor={`up-${target}`}>
              {w.chooseLabel}
            </Label>
            <input
              id={`up-${target}`}
              name="files"
              type="file"
              multiple
              required
              accept={accept}
              // No `capture` here, deliberately. On a phone it does not hint at
              // the camera — it *replaces* the picker with it, and the browser
              // then ignores `multiple`: one photo, no way to reach the
              // gallery. A grower sending three pictures of the same problem
              // could only send one. The camera is still one tap away inside
              // the picker on both iOS and Android.
              // text-base, not text-sm: iOS Safari zooms the whole page when a
              // focused control is under 16px, and a file input is a control
              // like any other.
              className="block w-full text-base text-body file:me-3 file:min-h-11 file:rounded-full file:border-0 file:bg-tint file:px-4 file:text-sm file:font-medium file:text-forest hover:file:bg-tint/70"
            />
            <p className="mt-1.5 text-xs text-muted">
              {limitNote} {w.oneAtATime}
            </p>
          </Field>

          {target === "document" ? (
            <Field>
              <Label htmlFor="up-category">{w.whatIsIt}</Label>
              <Select id="up-category" name="category" defaultValue="OTHER">
                {(w.categories ?? DOCUMENT_CATEGORIES).map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field>
            <Label htmlFor={`cap-${target}`}>{w.caption}</Label>
            <Input
              id={`cap-${target}`}
              name="caption"
              placeholder={w.captionHint}
            />
          </Field>

          {progress ? (
            <div>
              <p className="flex justify-between gap-3 text-xs text-muted">
                <span className="min-w-0 truncate">{progress.file}</span>
                <span className="shrink-0 tabular-nums">
                  {progress.percent}%
                </span>
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line-soft">
                <div
                  className="h-full rounded-full bg-moss transition-[width] duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          ) : null}

          {failures.length > 0 ? (
            <ul
              role="alert"
              className="space-y-1 rounded-lg bg-danger/8 px-3 py-2 text-sm text-danger"
            >
              {failures.map((f) => (
                <li key={f.file}>{!f.ok ? f.error : null}</li>
              ))}
            </ul>
          ) : null}

          {done ? <p className="text-sm text-moss">{done}</p> : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Paperclip className="size-4" />
              )}
              {busy ? w.sending : w.send}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              {w.cancel}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/**
 * Removing something the grower added.
 *
 * Only rendered for files they uploaded themselves — the server refuses the
 * rest, and offering a button that always fails would be worse than not
 * offering one.
 */
export function DeleteOwnUpload({
  attachmentId,
  filename,
  removeLabel,
  confirmText,
}: {
  attachmentId: string;
  filename: string;
  /**
   * The button's title and accessible name, in the reader's language.
   *
   * Optional with an English fallback rather than required: this is a client
   * component reached from four pages, and a missing word should degrade to
   * English rather than fail the build on a page that has not been threaded
   * through yet.
   */
  removeLabel?: string;
  /** The confirmation question, with {name} already filled in. */
  confirmText?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={removeLabel ?? `Remove ${filename}`}
        title={removeLabel ?? "Remove this — you added it"}
        disabled={pending}
        onClick={async () => {
          const question =
            confirmText ?? `Remove ${filename}? This cannot be undone.`;
          if (!confirm(question)) return;
          setPending(true);
          const result = await deleteOwnUpload(attachmentId);
          if (result?.error) setError(result.error);
          setPending(false);
        }}
        className="grid size-11 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
      </button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </>
  );
}
