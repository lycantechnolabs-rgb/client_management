import { authorizeAttachment } from "@/lib/attachment-access";
import { clampWidth, getThumbnail } from "@/lib/thumbnails";

/**
 * A small copy of a grower's own photograph.
 *
 * Behind exactly the same check as the full file — the check itself is shared,
 * in attachment-access.ts, so this route cannot quietly become the lenient one.
 * What differs is only the size of the answer, and that the answer may be
 * cached by the viewer's own browser.
 *
 * That caching is why this is a separate route rather than a `?w=` on
 * /api/files/[id]: next.config forces `private, no-store` on everything under
 * /api/files, which is right for a lab report and wrong for a thumbnail the
 * same person is about to scroll past twice. `private` still means no shared
 * cache may hold it — only the browser of the person already allowed to see it.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const access = await authorizeAttachment(id);
  if (!access.ok) {
    return new Response(access.status === 403 ? access.reason : "Not found", {
      status: access.status,
      headers: { "cache-control": "private, no-store" },
    });
  }

  const { attachment } = access;

  // Only photographs. A video or a PDF has no thumbnail here, and answering
  // 404 is better than quietly returning something that is not what was asked
  // for — the caller should be linking to /api/files for those.
  if (attachment.kind !== "IMAGE") {
    return new Response("Not found", { status: 404 });
  }

  const requested = Number(new URL(request.url).searchParams.get("w") ?? 400);
  const width = clampWidth(Number.isFinite(requested) ? requested : 400);

  const thumb = await getThumbnail(attachment.storageKey, attachment.mimeType, width);

  // Nothing to resize — an SVG, or a file sharp could not read. Say so rather
  // than serving the original: a route that sometimes returns a 4 MB original
  // in place of a thumbnail is worse than one that fails predictably, because
  // the caller cannot tell which it got.
  if (!thumb) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(thumb.bytes), {
    headers: {
      "Content-Type": thumb.contentType,
      "Content-Length": String(thumb.bytes.byteLength),
      // Private: the viewer's own browser may keep it, no shared cache may.
      // Immutable is safe because the URL names one attachment at one width,
      // and an attachment's bytes never change — a new photograph is a new row.
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
      // Re-encoded by us, so it is genuinely a WebP and not a document
      // wearing an image's name. The sandbox stays anyway: it costs nothing.
      "Content-Security-Policy": "sandbox; default-src 'none'",
    },
  });
}
