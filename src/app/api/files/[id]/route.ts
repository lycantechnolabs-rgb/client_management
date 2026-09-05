import { authorizeAttachment } from "@/lib/attachment-access";
import { readStoredFile } from "@/lib/files";
import { storage, storageIsRemote } from "@/lib/storage";

/**
 * The only way to read a client attachment.
 *
 * Same rule as everywhere else in the portal: the client ID comes from the
 * session, never from the request. The URL names an attachment; whether the
 * caller may read it is decided here against the database, so guessing an ID
 * gains nothing. Admin sees everything, a grower sees only their own, and
 * anyone else gets the same 404 as a row that does not exist — a 403 would
 * confirm the attachment is real.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // The check itself lives in attachment-access.ts, shared with the thumbnail
  // route. Two copies of an access rule is the shape that drifts: one gets a
  // fix, the other does not, and the one that did not is still serving other
  // people's photographs.
  const access = await authorizeAttachment(id);
  if (!access.ok) {
    return new Response(access.status === 403 ? access.reason : "Not found", {
      status: access.status,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { attachment } = access;

  // With remote storage the bytes are not here to stream, and pulling a 200 MB
  // video through a serverless function to hand it on would be slow, expensive
  // and capped by the platform's response limits anyway. The ownership check
  // above still happens on every request; what changes is that the answer is a
  // short-lived URL rather than the file.
  //
  // That URL is a bearer token for its lifetime, which is why it is minted only
  // after the check and lives for a minute. The sandbox CSP below is lost on
  // the redirect, but the risk it defends against — an uploaded file running
  // script against this origin — goes with it: the bytes are served from the
  // bucket's origin, which has no access to our session.
  if (storageIsRemote()) {
    const url = await storage().readUrl(
      attachment.storageKey,
      attachment.filename,
      attachment.mimeType || "application/octet-stream",
    );
    if (!url) return new Response("Not found", { status: 404 });

    return new Response(null, {
      status: 302,
      headers: {
        location: url,
        // The redirect itself must never be cached: the next person asking
        // may not be allowed, and the URL inside it expires.
        "cache-control": "private, no-store",
      },
    });
  }

  const bytes = await readStoredFile(attachment.storageKey);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      // Never let a shared cache hold one grower's document and hand it to
      // the next request. This is per-user data behind a session check.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // User-supplied bytes served from our own origin: the sandbox stops a
      // crafted SVG or PDF from running script against this session.
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.filename)}"`,
    },
  });
}
