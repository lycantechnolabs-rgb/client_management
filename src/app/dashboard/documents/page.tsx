import { Download, FileText } from "lucide-react";
import { can } from "@/lib/access";
import { uploadCapacity } from "@/lib/upload-capacity";
import { PermissionNotice } from "@/components/permission-notice";
import { DeleteOwnUpload, UploadForm } from "../uploads/upload-form";
import { requireClient } from "@/lib/session";
import { attachmentHref } from "@/lib/files";
import { getDocuments } from "@/lib/queries";
import { Card, CardBody, EmptyState } from "@/components/ui";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { shortDate } from "@/lib/utils";
import { getI18n } from "@/lib/i18n";
import { docCategoryIn } from "@/lib/i18n/labels";

export const metadata = { title: "Documents" };

function prettySize(bytes: number | null) {
  if (!bytes) return "";
  const mb = bytes / 1_048_576;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default async function DocumentsPage() {
  const [{ locale, t }, user] = await Promise.all([getI18n(), requireClient()]);
  const [docs, canDownload, canUpload, canDeleteOwn] = await Promise.all([
    getDocuments(user.clientId),
    can("DOWNLOAD_OWN_FILES"),
    can("UPLOAD_DOCUMENTS"),
    can("DELETE_OWN_UPLOADS"),
  ]);
  // No storage means no upload form. A button that always fails is worse
  // than no button; the operator is told in the server log instead.
  const { limits, available } = uploadCapacity();

  if (docs.length === 0) {
    return (
      <div className="space-y-5">
        <EmptyState
          title={t("docs.noneYet")}
          description={t("docs.noneYetBody")}
          variant="glass"
        />
        {canUpload && available ? (
          <UploadForm target="document"
        w={{
          open: t("docs.add"),
          chooseLabel: t("upload.chooseDoc"),
          caption: t("upload.caption"),
          captionHint: t("upload.captionHint"),
          whatIsIt: t("upload.whatIsIt"),
          send: t("upload.send"),
          sending: t("upload.sending"),
          cancel: t("upload.cancel"),
          added: t("upload.added"),
          categories: DOCUMENT_CATEGORIES.map((c) => ({
            key: c.key,
            label: docCategoryIn(t, c.key),
          })),
          oneAtATime: t("upload.oneAtATime"),
        }} canUpload limits={limits} />
        ) : null}
      </div>
    );
  }

  const label = (key: string | null) => docCategoryIn(t, key ?? "OTHER");

  const groups = new Map<string, typeof docs>();
  for (const d of docs) {
    const key = d.category ?? "OTHER";
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }

  return (
    <div className="space-y-6">
      {canDownload ? null : <PermissionNotice what="Downloading documents" />}

      {canUpload && available ? (

        <UploadForm target="document"
        w={{
          open: t("docs.add"),
          chooseLabel: t("upload.chooseDoc"),
          caption: t("upload.caption"),
          captionHint: t("upload.captionHint"),
          whatIsIt: t("upload.whatIsIt"),
          send: t("upload.send"),
          sending: t("upload.sending"),
          cancel: t("upload.cancel"),
          added: t("upload.added"),
          categories: DOCUMENT_CATEGORIES.map((c) => ({
            key: c.key,
            label: docCategoryIn(t, c.key),
          })),
          oneAtATime: t("upload.oneAtATime"),
        }} canUpload limits={limits} />
        ) : null}

      {[...groups.entries()].map(([category, items]) => (
        <section key={category}>
          <h2 className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted">
            {label(category)}
          </h2>
          <Card variant="glass">
            <CardBody className="p-0 sm:p-0">
              <ul className="divide-y divide-line-soft">
                {items.map((d) => (
                  <li key={d.id}>
                    <a
                      href={attachmentHref(d)}
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
                          {shortDate(d.createdAt, locale)}
                          {d.sizeBytes ? ` · ${prettySize(d.sizeBytes)}` : ""}
                          {d.activity ? ` · ${d.activity.title}` : ""}
                        </span>
                      </span>
                      <Download className="size-4 shrink-0 text-muted" />
                    </a>
                    {canDeleteOwn && d.uploadedById === user.id ? (
                      <div className="flex justify-end px-2 pb-2">
                        <DeleteOwnUpload
                          attachmentId={d.id}
                          filename={d.filename}
                          removeLabel={t("photos.removeYours")}
                          confirmText={t("photos.confirmRemove", {
                            name: d.filename,
                          })}
                        />
                      </div>
                    ) : null}
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
