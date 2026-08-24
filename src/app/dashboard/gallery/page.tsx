import Image from "next/image";
import Link from "next/link";
import { requireClient } from "@/lib/session";
import { attachmentHref } from "@/lib/files";
import { getMedia } from "@/lib/queries";
import { EmptyState, SectionHeading } from "@/components/ui";
import { VideoPlayer } from "@/components/video-player";
import { shortDate } from "@/lib/utils";

export const metadata = { title: "Photos & videos" };

export default async function GalleryPage() {
  const user = await requireClient();
  const [images, videos] = await Promise.all([
    getMedia(user.clientId, "IMAGE"),
    getMedia(user.clientId, "VIDEO"),
  ]);

  if (images.length === 0 && videos.length === 0) {
    return (
      <EmptyState
        title="No photos yet"
        description="Photos from every visit to your estate will collect here."
      />
    );
  }

  return (
    <div className="space-y-8">
      {videos.length > 0 ? (
        <section>
          <SectionHeading title={`Videos (${videos.length})`} />
          <div className="grid gap-3 sm:grid-cols-2">
            {videos.map((v) => (
              <VideoPlayer key={v.id} src={attachmentHref(v)} caption={v.caption} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeading title={`Photos (${images.length})`} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => {
            const inner = (
              <>
                <Image
                  src={attachmentHref(img)}
                  unoptimized
                  alt={img.caption ?? "Estate photo"}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/75 to-transparent p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="truncate text-[11px] text-cream">
                    {img.activity?.title ?? img.caption}
                  </p>
                  <p className="text-[10px] text-cream/70">
                    {shortDate(img.createdAt)}
                  </p>
                </div>
              </>
            );

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
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
