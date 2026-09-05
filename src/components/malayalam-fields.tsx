"use client";

import { useState } from "react";
import { Languages } from "lucide-react";

import { Field, Input, Textarea } from "@/components/ui";

/**
 * Where Jinto writes the Malayalam for what he just typed in English.
 *
 * Folded away rather than always open. Most of his growers read English, and a
 * form that demands two versions of everything is a form he stops filling in
 * properly — at which point the growers who need Malayalam get worse notes, not
 * better ones. Open it when it matters, skip it when it does not; skipping
 * leaves the grower with English, exactly as before.
 *
 * It opens by itself when there is already something stored, because an edit
 * screen that hides an existing translation invites him to change the English
 * and leave stale Malayalam underneath it.
 */
export function MalayalamFields({
  titleValue,
  notesValue,
}: {
  /** What is already stored, on the edit form. Absent when creating. */
  titleValue?: string;
  notesValue?: string;
}) {
  const hasExisting = Boolean(titleValue || notesValue);
  const [open, setOpen] = useState(hasExisting);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-moss hover:text-forest"
      >
        <Languages className="size-4" />
        Add the Malayalam
      </button>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-line-soft bg-tint/25 p-4">
      <p className="flex items-center gap-2 text-xs text-muted">
        <Languages className="size-4 shrink-0 text-moss" />
        Growers who have chosen മലയാളം see these instead. Leave a box empty and
        they see the English.
      </p>

      <Field label="Title in Malayalam">
        <Input
          name="titleMl"
          lang="ml"
          defaultValue={titleValue}
          placeholder="രണ്ടാം ഘട്ട വളപ്രയോഗം"
        />
      </Field>

      <Field label="Notes in Malayalam">
        <Textarea
          name="notesMl"
          lang="ml"
          rows={4}
          defaultValue={notesValue}
          placeholder="ഓരോ ചുവടിന്റെയും ചുവട്ടിൽ, ചെടിയിൽ നിന്ന് 20 സെ.മീ അകലെ ഇട്ടു."
        />
      </Field>
    </div>
  );
}
