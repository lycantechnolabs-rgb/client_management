import { AlertTriangle } from "lucide-react";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { Card, CardBody } from "@/components/ui";
import { en, type StringKey } from "@/lib/i18n/en";
import { ml } from "@/lib/i18n/ml";
import { ReviewForm, type Row } from "./review-form";

export const metadata = { title: "Malayalam" };

/**
 * Where the Malayalam draft becomes real Malayalam.
 *
 * The portal ships with a machine-written draft — see src/lib/i18n/ml.ts, which
 * says so at the top. Jinto reads Malayalam, so the review happens here rather
 * than in a code change: what he types is what growers see from the next page
 * load, and the act of typing records that a person has read the string.
 *
 * Grouped by where the words appear so a screen can be reviewed as a screen.
 */
const GROUPS: { name: string; prefix: string }[] = [
  { name: "Menu", prefix: "nav." },
  // The estate vocabulary, first after the menu: these are the words a grower
  // reads on every badge and every filter, and the ones a machine draft is most
  // likely to get wrong. Leaving them off this screen — which they were —
  // meant the drafts nobody could correct were the drafts that mattered most.
  { name: "Kinds of work", prefix: "activityType." },
  { name: "Input categories", prefix: "materialCategory." },
  { name: "Document types", prefix: "docCategory." },
  { name: "Picking rounds", prefix: "rounds." },
  { name: "Home screen", prefix: "home." },
  { name: "Work log", prefix: "work." },
  { name: "One visit", prefix: "visit." },
  { name: "Money", prefix: "money." },
  { name: "Harvest", prefix: "harvest." },
  { name: "Photos and documents", prefix: "photos." },
  { name: "Documents", prefix: "docs." },
  { name: "Uploading", prefix: "upload." },
  { name: "Messages", prefix: "messages." },
  { name: "Profile", prefix: "profile." },
  { name: "Settings", prefix: "settings." },
  { name: "Input log", prefix: "inputs." },
  { name: "Filters", prefix: "filter." },
  { name: "Tables", prefix: "table." },
  { name: "Dates", prefix: "date." },
  { name: "Your data", prefix: "data." },
  { name: "Video", prefix: "video." },
  { name: "On a work card", prefix: "card." },
  { name: "Shared words", prefix: "common." },
];

export default async function LanguagePage() {
  await requireAdmin();

  const saved = await db.translation.findMany({ where: { locale: "ml" } });
  const byKey = new Map(saved.map((row) => [row.key, row]));

  const keys = Object.keys(en) as StringKey[];
  const groups = GROUPS.map((group) => ({
    name: group.name,
    rows: keys
      .filter((key) => key.startsWith(group.prefix))
      .map<Row>((key) => {
        const row = byKey.get(key);
        return {
          key,
          english: en[key],
          current: row?.value ?? ml[key],
          reviewed: row?.reviewed ?? false,
        };
      }),
  })).filter((g) => g.rows.length > 0);

  const total = keys.length;
  const reviewed = saved.filter((r) => r.reviewed).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl text-forest lg:hidden">Malayalam</h1>
        <p className="mt-1 text-sm text-body lg:mt-0">
          What a grower sees when they choose മലയാളം in their settings.
        </p>
      </div>

      {reviewed < total ? (
        <Card className="border-warning/40 bg-warning/8">
          <CardBody className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium text-forest">
              <AlertTriangle className="size-4 shrink-0 text-warning" />
              {total - reviewed} of {total} still unchecked
            </p>
            <p className="text-sm text-body">
              The Malayalam this ships with was written by the machine that built
              the rest of the portal, and no Malayalam speaker has read it. It is
              a starting point, not finished text — please correct anything that
              is wrong or simply is not what a grower in Idukki would say. The
              estate words are the ones most likely to be off.
            </p>
            <p className="text-sm text-body">
              Saving a line marks it checked, whether you changed it or not.
              Growers are never told any of this — they just see the words.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card className="border-moss/30 bg-tint/30">
          <CardBody>
            <p className="text-sm text-body">
              All {total} strings have been checked by a Malayalam speaker.
            </p>
          </CardBody>
        </Card>
      )}

      <Card className="border-line bg-cream/40">
        <CardBody>
          <p className="text-sm text-body">
            The privacy notice is <strong>not</strong> here. That is legal text
            and needs a translator rather than a review — a mistranslated notice
            misinforms where a missing one merely omits. Its worksheet is at{" "}
            <code className="text-xs">docs/dpdp/malayalam-translation.md</code>.
          </p>
        </CardBody>
      </Card>

      <ReviewForm locale="ml" groups={groups} />
    </div>
  );
}
