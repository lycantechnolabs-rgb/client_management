"use client";

import { useActionState } from "react";
import { CheckCircle2, Languages, Loader2 } from "lucide-react";

import { Button, Card, CardBody, Field, Input, Label, Textarea } from "@/components/ui";
import { translateActivityByHand, type ActionState } from "../../actions";

/**
 * Adding Malayalam to an entry that already exists.
 *
 * The new-work form has these boxes beside the English, which covers everything
 * written from now on. This covers everything written before — which on the day
 * this shipped was every entry in the book, and a grower reading Malayalam does
 * not care which side of that line their estate's history falls on.
 *
 * It shows the English it is translating rather than assuming Jinto remembers
 * what he typed. The Malayalam is keyed to that exact wording: change the
 * English later and this becomes stale, which is why the sentence is on screen
 * while he types underneath it.
 */
export function TranslatePanel({
  activityId,
  title,
  notes,
  titleMl,
  notesMl,
}: {
  activityId: string;
  /** The English being translated. Shown, not editable — this is not the edit form. */
  title: string;
  notes: string | null;
  /** What is already stored, if anything. */
  titleMl: string;
  notesMl: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    translateActivityByHand,
    {},
  );

  return (
    <Card>
      <CardBody>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="activityId" value={activityId} />

          <div className="flex items-center gap-2">
            <Languages className="size-4 shrink-0 text-moss" />
            <Label>Malayalam</Label>
          </div>
          <p className="text-xs text-muted">
            What growers who have chosen മലയാളം will read instead. Leave a box
            empty and they see the English.
          </p>

          <Field label="Title">
            <p className="mb-1.5 rounded-lg bg-cream px-3 py-2 text-sm text-body">
              {title}
            </p>
            <Input
              name="titleMl"
              lang="ml"
              defaultValue={titleMl}
              placeholder="രണ്ടാം ഘട്ട വളപ്രയോഗം"
            />
          </Field>

          {notes ? (
            <Field label="Notes">
              <p className="mb-1.5 whitespace-pre-line rounded-lg bg-cream px-3 py-2 text-sm text-body">
                {notes}
              </p>
              <Textarea
                name="notesMl"
                lang="ml"
                rows={4}
                defaultValue={notesMl}
                placeholder="ഓരോ ചുവടിന്റെയും ചുവട്ടിൽ ഇട്ടു."
              />
            </Field>
          ) : null}

          {state.error ? (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          ) : null}
          {state.ok ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-moss">
              <CheckCircle2 className="size-4" />
              {state.message}
            </p>
          ) : null}

          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {pending ? "Saving…" : "Save the Malayalam"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
