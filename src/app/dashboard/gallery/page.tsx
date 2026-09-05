import Link from "next/link";
import { can } from "@/lib/access";
import { uploadCapacity } from "@/lib/upload-capacity";
import { PermissionNotice } from "@/components/permission-notice";
import { DeleteOwnUpload, UploadForm } from "../uploads/upload-form";
import { requireClient } from "@/lib/session";
import { attachmentHref, thumbnailHref } from "@/lib/files";
import { getMedia } from "@/lib/queries";
import { EmptyState, SectionHeading } from "@/components/ui";
import { VideoPlayer } from "@/components/video-player";
import { shortDate } from "@/lib/utils";
import { getI18n } from "@/lib/i18n";
import { translateMedia } from "@/lib/translate/activities";

export const metadata = { title: "Photos & videos" };

export default async function GalleryPage() {
  const { locale, t } = await getI18n();
  const user = await requireClient();
  const [images, videos] = await Promise.all([
    getMedia(user.clientId, "IMAGE"),
    getMedia(user.clientId, "VIDEO"),
  ]);

  // A caption is often the only sentence attached to a photograph, so it is
  // the whole of what that photograph says. Both lists in one batch.
  const [shownImages, shownVideos] = await Promise.all([
    translateMedia(images, locale),
    translateMedia(videos, locale),
  ]);
  const canDownload = await can("DOWNLOAD_OWN_FILES");
  // Either permission is enough to open the form; the action re-checks per file
  // against the kind it actually turns out to be.
  const canUpload =
    (await can("UPLOAD_PHOTOS")) || (await can("UPLOAD_VIDEOS"));
  // No storage means no upload form. A button that always fails is worse
  // than no button; the operator is told in the server log instead.
  const { limits, available } = uploadCapacity();
  // The gallery is where a grower's own photos land, so it is where they need
  // to be able to take one back — a wrong photo from the estate is the most
  // likely upload mistake there is. The action already refuses anything Jinto
  // added, and already revalidated this page, but the control was missing here
  // while the documents page had it.
  const canDeleteOwn = await can("DELETE_OWN_UPLOADS");

  if (images.length === 0 && videos.length === 0) {
    return (
      <div className="space-y-5">
        <EmptyState
          title={t("photos.noneYet")}
          description={t("photos.noneYetBody")}
          variant="glass"
        />
        {canUpload && available ? (
          <UploadForm target="media"
        w={{
          open: t("photos.add"),
          chooseLabel: t("upload.chooseFiles"),
          caption: t("upload.caption"),
          captionHint: t("upload.captionHint"),
          whatIsIt: t("upload.whatIsIt"),
          send: t("upload.send"),
          sending: t("upload.sending"),
          cancel: t("upload.cancel"),
          added: t("upload.added"),
          oneAtATime: t("upload.oneAtATime"),
        }} canUpload limits={limits} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {canDownload ? null : <PermissionNotice what="Saving photos and videos" />}

      {canUpload && available ? (

        <UploadForm target="media"
        w={{
          open: t("photos.add"),
          chooseLabel: t("upload.chooseFiles"),
          caption: t("upload.caption"),
          captionHint: t("upload.captionHint"),
          whatIsIt: t("upload.whatIsIt"),
          send: t("upload.send"),
          sending: t("upload.sending"),
          cancel: t("upload.cancel"),
          added: t("upload.added"),
          oneAtATime: t("upload.oneAtATime"),
        }} canUpload limits={limits} />
        ) : null}

      {videos.length > 0 ? (
        <section>
          <SectionHeading title={`${t("photos.videosCount")} (${videos.length})`} />
          <div className="grid gap-3 sm:grid-cols-2">
            {shownVideos.map((v) => (
              <div key={v.id} className="space-y-1">
                <VideoPlayer
                  src={attachmentHref(v)}
                  caption={v.caption}
                  downloadWord={t("video.download")}
                  cannotPlayWord={t("video.cannotPlay")}
                />
                {canDeleteOwn && v.uploadedById === user.id ? (
                  <div className="flex justify-end">
                    <DeleteOwnUpload
                      attachmentId={v.id}
                      filename={v.filename}
                      removeLabel={t("photos.removeYours")}
                      confirmText={t("photos.confirmRemove", { name: v.filename })}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeading title={`${t("photos.photosCount")} (${images.length})`} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {shownImages.map((img) => {
            const thumb = thumbnailHref(img, 400);
            const inner = (
              <>
                {/*
                  A plain <img>, not next/image, and `unoptimized` would be
                  beside the point either way: Next's optimiser fetches the
                  source itself with no session, so /api/files hands it the same
                  404 a stranger gets. Private photographs cannot go through it.

                  So the resizing happens behind our own ownership check
                  instead, and this asks for it by width. The grid shows two
                  columns on a phone and four on a laptop, so 200 and 400 cover
                  1x and 2x on the small screens where it matters; the browser
                  picks from the srcset and never fetches the 4 MB original.

                  `thumb` is null for the seeded SVG illustrations and for any
                  older row with a public URL — those fall back to the original,
                  which is small and already the right thing.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element --
                    the rule's advice is to use next/image "or a custom image
                    loader"; this is the loader, at /api/thumb. next/image
                    itself cannot serve these, for the reason above. */}
                <img
                  src={thumb ?? attachmentHref(img)}
                  srcSet={
                    thumb
                      ? `${thumbnailHref(img, 200)} 200w, ${thumbnailHref(img, 400)} 400w, ${thumbnailHref(img, 800)} 800w`
                      : undefined
                  }
                  sizes="(max-width: 640px) 50vw, 25vw"
                  alt={img.caption ?? "Estate photo"}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/75 to-transparent p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="truncate text-[11px] text-cream">
                    {img.activity?.title ?? img.caption}
                  </p>
                  <p className="text-[10px] text-cream/70">
                    {shortDate(img.createdAt, locale)}
                  </p>
                </div>
              </>
            );

            const mine = canDeleteOwn && img.uploadedById === user.id;

            // A photo tied to a visit opens that visit; one the grower added
            // themselves has nowhere to go, so it carries its own remove
            // control instead. The two are mutually exclusive on purpose —
            // nesting a button inside a link gives a phone two overlapping
            // targets and no way to tell which one a thumb hit.
            return img.activity ? (
              <Link
                key={img.id}
                href={`/dashboard/activities/${img.activity.id}`}
                className="group relative aspect-square overflow-hidden rounded-xl bg-tint"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={img.id}
                className="group relative aspect-square overflow-hidden rounded-xl bg-tint"
              >
                {inner}
                {mine ? (
                  <div className="absolute right-1 top-1 rounded-lg bg-surface/85 backdrop-blur-sm">
                    <DeleteOwnUpload
                      attachmentId={img.id}
                      filename={img.filename}
                      removeLabel={t("photos.removeYours")}
                      confirmText={t("photos.confirmRemove", {
                        name: img.filename,
                      })}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
