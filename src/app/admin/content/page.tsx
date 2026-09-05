import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { requireAdmin } from "@/lib/session";
import { getContent } from "@/lib/content";
import { Card, CardBody } from "@/components/ui";
import { ContentForm } from "./content-form";

export const metadata = { title: "Website content" };

/**
 * Doc 05's "Website Content — manage public website content".
 *
 * Scoped to a declared list of fields rather than the whole page. The reasoning
 * is in src/lib/site-content.ts; the short version is that everything here is
 * plain text rendered where it already sits, so editing cannot break the layout
 * and cannot inject markup into a public page.
 */
export default async function ContentPage() {
  await requireAdmin();
  const values = await getContent();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl text-forest lg:hidden">
          Website content
        </h1>
        <p className="mt-1 text-sm text-body lg:mt-0">
          The wording on the public site, and the contact details that appear
          across it. Changes are live as soon as you save.
        </p>
      </div>

      <Card className="border-moss/30 bg-tint/25">
        <CardBody className="space-y-2">
          <p className="text-sm text-body">
            Your phone number and email are used in more places than the contact
            page — the sign-in page, every grower&apos;s portal, and the privacy
            notice growers are entitled to. Changing it here changes all of
            them, which is the point: there is nowhere it can be left stale.
          </p>
          <Link
            href="/"
            target="_blank"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm text-forest underline underline-offset-2"
          >
            Open the public site
            <ExternalLink className="size-3.5" />
          </Link>
        </CardBody>
      </Card>

      <ContentForm values={values} />
    </div>
  );
}
