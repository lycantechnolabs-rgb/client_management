"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, Save } from "lucide-react";

import { Button, Card, CardBody, CardTitle } from "@/components/ui";
import { saveTranslations, type ReviewState } from "./actions";

export type Row = {
  key: string;
  english: string;
  current: string;
  /** True once a person has read this string, not merely changed it. */
  reviewed: boolean;
};

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Save className="size-4" />
      )}
      {pending ? "Saving…" : label}
    </Button>
  );
}

/**
 * One group, one form.
 *
 * A single form around every group looked tidier and was wrong: saving it wrote
 * a row for all 116 strings, so reading the menu marked the whole portal as
 * checked by a Malayalam speaker. The count is the only thing that says how
 * much of the machine draft a person has actually read — a count that reaches
 * 116 the first time anything is saved answers nothing.
 *
 * A form per group means the answer stays true, and the button can honestly say
 * what it does.
 */
function Group({
  locale,
  name,
  rows,
}: {
  locale: string;
  name: string;
  rows: Row[];
}) {
  const [state, action] = useActionState<ReviewState, FormData>(
    saveTranslations,
    {},
  );
  const checked = rows.filter((r) => r.reviewed).length;

  return (
    <Card>
      <CardBody>
        <form action={action} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />

          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle>{name}</CardTitle>
            <span className="text-xs text-muted">
              {checked} of {rows.length} checked
            </span>
          </div>

          {rows.map((row) => (
            <div
              key={row.key}
              className="grid gap-1.5 border-t border-line-soft pt-3 sm:grid-cols-2 sm:gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-body">{row.english}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted">
                  {row.key}
                </p>
              </div>
              <div>
                <input
                  name={`s:${row.key}`}
                  defaultValue={row.current}
                  lang={locale}
                  // text-base: iOS Safari zooms the page on a focused control
                  // under 16px, and this form is a long list of them.
                  className="block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base text-forest"
                />
                {!row.reviewed ? (
                  <p className="mt-1 text-[11px] text-warning">
                    Draft — not checked yet
                  </p>
                ) : null}
              </div>
            </div>
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

          <SaveButton label={`Save ${name.toLowerCase()}`} />
        </form>
      </CardBody>
    </Card>
  );
}

/**
 * The English beside the Malayalam, one line each.
 *
 * Side by side rather than Malayalam alone, because the review question is not
 * "is this good Malayalam" but "does this say what the English says". A word can
 * be perfectly good Malayalam and the wrong label.
 *
 * Grouped by where the strings appear, so a reviewer reads a screen's worth at
 * a time and can picture it, rather than working down 116 unrelated lines.
 */
export function ReviewForm({
  locale,
  groups,
}: {
  locale: string;
  groups: { name: string; rows: Row[] }[];
}) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <Group
          key={group.name}
          locale={locale}
          name={group.name}
          rows={group.rows}
        />
      ))}
    </div>
  );
}
