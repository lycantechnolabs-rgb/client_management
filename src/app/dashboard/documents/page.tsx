import { Download, FileText } from "lucide-react";
import { requireClient } from "@/lib/session";
import { getDocuments } from "@/lib/queries";
import { Card, CardBody, EmptyState } from "@/components/ui";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { shortDate } from "@/lib/utils";

export const metadata = { title: "Documents" };

function prettySize(bytes: number | null) {
  if (!bytes) return "";
  const mb = bytes / 1_048_576;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default async function DocumentsPage() {
  const user = await requireClient();
  const docs = await getDocuments(user.clientId);

  if (docs.length === 0) {
    return (
      <EmptyState
        title="No documents yet"
        description="Lab reports, auction slips, invoices and certificates will be filed here."
      />
    );
  }

  const label = (key: string | null) =>
    DOCUMENT_CATEGORIES.find((c) => c.key === key)?.label ?? "Other";

  const groups = new Map<string, typeof docs>();
  for (const d of docs) {
    const key = d.category ?? "OTHER";
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([category, items]) => (
        <section key={category}>
          <h2 className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted">
            {label(category)}
          </h2>
          <Card>
            <CardBody className="p-0 sm:p-0">
              <ul className="divide-y divide-line-soft">
                {items.map((d) => (
                  <li key={d.id}>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3.5 hover:bg-cream sm:px-5"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-tint">
                        <FileText className="size-5 text-moss" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-forest">
                          {d.filename}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {shortDate(d.createdAt)}
                          {d.sizeBytes ? ` · ${prettySize(d.sizeBytes)}` : ""}
                          {d.activity ? ` · ${d.activity.title}` : ""}
                        </span>
                      </span>
                      <Download className="size-4 shrink-0 text-muted" />
                    </a>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </section>
      ))}
    </div>
  );
}
