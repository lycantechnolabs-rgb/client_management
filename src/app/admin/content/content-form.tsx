"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, RotateCcw, Save } from "lucide-react";

import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Field,
  Input,
  Label,
  Textarea,
} from "@/components/ui";
import {
  CONTENT_FIELDS,
  CONTENT_GROUPS,
  type ContentField,
} from "@/lib/site-content";
import { resetContent, saveContent, type ContentState } from "./actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Save className="size-4" />
      )}
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

/**
 * One field, with the shipped text alongside it.
 *
 * Showing the original matters more than it looks: this is the only way for
 * Jinto to know whether a sentence is his or ours, and the only way back if he
 * changes his mind six months later. Without it, editing is one-way.
 */
function ContentInput({
  field,
  value,
  isEdited,
  onReset,
}: {
  field: ContentField;
  value: string;
  isEdited: boolean;
  onReset: (key: string) => void;
}) {
  const id = `content-${field.key}`;

  return (
    <Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>{field.label}</Label>
        {isEdited ? (
          <button
            type="button"
            onClick={() => onReset(field.key)}
            className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted underline-offset-2 hover:text-forest hover:underline"
          >
            <RotateCcw className="size-3.5" />
            Put back the original
          </button>
        ) : null}
      </div>

      {field.multiline ? (
        <Textarea
          id={id}
          name={field.key}
          defaultValue={value}
          rows={4}
          maxLength={field.maxLength}
        />
      ) : (
        <Input
          id={id}
          name={field.key}
          defaultValue={value}
          maxLength={field.maxLength}
        />
      )}

      <p className="mt-1.5 text-xs text-muted">{field.help}</p>

      {isEdited ? (
        <p className="mt-1 text-xs text-muted">
          Originally:{" "}
          <span className="text-body">
            {field.fallback || <em>empty</em>}
          </span>
        </p>
      ) : null}
    </Field>
  );
}

export function ContentForm({ values }: { values: Record<string, string> }) {
  const [state, action] = useActionState<ContentState, FormData>(saveContent, {});
  const [resetting, setResetting] = useState<string | null>(null);
  const [resetNote, setResetNote] = useState<string | null>(null);

  async function onReset(key: string) {
    setResetting(key);
    setResetNote(null);
    const result = await resetContent(key);
    setResetting(null);
    setResetNote(result.message ?? result.error ?? null);
  }

  return (
    <form action={action} className="space-y-6">
      {CONTENT_GROUPS.map((group) => (
        <Card key={group}>
          <CardBody className="space-y-5">
            <CardTitle>{group}</CardTitle>
            {CONTENT_FIELDS.filter((f) => f.group === group).map((field) => (
              <ContentInput
                key={field.key}
                field={field}
                value={values[field.key] ?? field.fallback}
                isEdited={(values[field.key] ?? field.fallback) !== field.fallback}
                onReset={onReset}
              />
            ))}
            {resetting ? (
              <p className="text-xs text-muted">Putting it back…</p>
            ) : null}
          </CardBody>
        </Card>
      ))}

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg bg-danger/8 px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      {state.message ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-moss">
          <CheckCircle2 className="size-4" />
          {state.message}
        </p>
      ) : null}

      {resetNote ? <p className="text-sm text-moss">{resetNote}</p> : null}

      {/* Sticky, because this form is long enough to scroll past the button on
          a phone. The offset has to clear the fixed bottom nav — min-h-16 plus
          the safe-area inset — or the button sits behind it and looks missing.
          There is no bottom nav from `lg` up, so it drops back to the edge. */}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] flex justify-start lg:bottom-3">
        <SaveButton />
      </div>
    </form>
  );
}
