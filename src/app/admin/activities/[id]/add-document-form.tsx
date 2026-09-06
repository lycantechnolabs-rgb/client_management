"use client";

import { useRef, useState, useTransition } from "react";
import { FileUp, Loader2, Plus } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { ACCEPT } from "@/lib/upload-limits";
import { addActivityDocument } from "../../actions";

export function AddDocumentForm({ activityId }: { activityId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await addActivityDocument({}, data);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        formRef.current?.reset();
        setOpen(false);
      }
    });
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen((o) => !o);
        }}
      >
        <Plus className="size-4" /> Add document
      </Button>

      {open ? (
        <form
          ref={formRef}
          onSubmit={submit}
          className="mt-3 space-y-3 rounded-xl border border-line-soft bg-cream/60 p-4"
        >
          <input type="hidden" name="activityId" value={activityId} />
          <Field label="Type of document">
            <Select name="category" defaultValue="INVOICE">
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="File" hint="PDF only, up to 25 MB.">
            <Input name="file" type="file" accept={ACCEPT.DOCUMENT} required />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileUp className="size-4" />
            )}
            Upload
          </Button>
        </form>
      ) : null}
    </div>
  );
}
