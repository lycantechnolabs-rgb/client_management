import { translateMany } from "./index";

/**
 * Jinto's writing, in the grower's language.
 *
 * Titles, notes and the captions on the photographs. Everything else on an
 * activity is a number, a date, a name, or a key with its own catalogue entry —
 * and translating a proper noun is how "Cheruvally Estate" becomes something
 * nobody can find on a map. Plot names, worker names and product names stay
 * exactly as written.
 *
 * One call for the whole list rather than one per row: a work log renders
 * twenty of each, and forty round trips would be slower than the page is worth
 * and cost forty times the minimum charge.
 */

/**
 * Collects strings, sends them in one batch, hands back a lookup.
 *
 * Written after the index arithmetic here produced a wrong answer once: the
 * fields were concatenated into one array and read back by offset, which is
 * correct exactly until a third field is added and every offset shifts. Looking
 * the result up by the original string cannot drift that way, and it also
 * collapses repeats for free — the uploader defaults a photo's caption to the
 * activity's title, so a visit with three photographs holds the same sentence
 * four times over.
 */
async function batch(locale: string) {
  const wanted = new Set<string>();
  return {
    add(text: string | null | undefined) {
      const t = (text ?? "").trim();
      if (t) wanted.add(t);
    },
    async resolve() {
      const sources = [...wanted];
      const out = await translateMany(sources, locale);
      const map = new Map(sources.map((s, i) => [s, out[i] || s]));
      /** The translation, or the original when there isn't one. */
      return (text: string | null | undefined) => {
        const t = (text ?? "").trim();
        return t ? (map.get(t) ?? text!) : text;
      };
    },
  };
}

type Captioned = { caption?: string | null };
type Translatable = {
  title: string;
  notes?: string | null;
  /** Optional: only some queries include them. */
  attachments?: Captioned[];
};

export async function translateActivities<T extends Translatable>(
  activities: T[],
  locale: string,
): Promise<T[]> {
  if (locale === "en" || activities.length === 0) return activities;

  const b = await batch(locale);
  for (const a of activities) {
    b.add(a.title);
    b.add(a.notes);
    // The caption is what a screen reader announces for the photograph — it is
    // the img's alt text on every card. Leaving it out left a Malayalam page
    // describing its own pictures in English to the readers least able to
    // work around it.
    for (const att of a.attachments ?? []) b.add(att.caption);
  }
  const tr = await b.resolve();

  return activities.map((a) => ({
    ...a,
    title: tr(a.title) as string,
    notes: tr(a.notes) as string | null | undefined,
    ...(a.attachments
      ? {
          attachments: a.attachments.map((att) => ({
            ...att,
            caption: tr(att.caption) as string | null | undefined,
          })),
        }
      : {}),
  }));
}

/** One activity, for a detail page. */
export async function translateActivity<T extends Translatable>(
  activity: T,
  locale: string,
): Promise<T> {
  const [one] = await translateActivities([activity], locale);
  return one;
}

/**
 * A caption on a photograph or document.
 *
 * Separate from the above because captions are often a fragment rather than a
 * sentence — "lower block, after pruning" — and are rendered in places where
 * the activity is not.
 */
export async function translateCaptions<T extends Captioned>(
  items: T[],
  locale: string,
): Promise<T[]> {
  if (locale === "en" || items.length === 0) return items;

  const b = await batch(locale);
  for (const item of items) b.add(item.caption);
  const tr = await b.resolve();

  return items.map((item) => ({
    ...item,
    caption: tr(item.caption) as string | null | undefined,
  }));
}

/**
 * A media tile: its caption, and the title of the visit it came from.
 *
 * The gallery prints `activity?.title ?? caption` under each photograph, so
 * translating only the caption leaves most tiles in English — most photographs
 * belong to a visit and are labelled by it. Both fields, one batch.
 */
export async function translateMedia<
  T extends { caption?: string | null; activity?: { title: string } | null },
>(items: T[], locale: string): Promise<T[]> {
  if (locale === "en" || items.length === 0) return items;

  const b = await batch(locale);
  for (const item of items) {
    b.add(item.caption);
    b.add(item.activity?.title);
  }
  const tr = await b.resolve();

  return items.map((item) => ({
    ...item,
    caption: tr(item.caption) as string | null | undefined,
    activity: item.activity
      ? { ...item.activity, title: tr(item.activity.title) as string }
      : item.activity,
  }));
}
