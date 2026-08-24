import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { readStoredFile } from "@/lib/files";

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

  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });

  const attachment = await db.attachment.findUnique({
    where: { id },
    select: {
      clientId: true,
      storageKey: true,
      filename: true,
      mimeType: true,
    },
  });
  if (!attachment?.storageKey) return new Response("Not found", { status: 404 });

  const allowed =
    user.role === "ADMIN" ||
    (user.role === "CLIENT" && user.clientId === attachment.clientId);
  if (!allowed) return new Response("Not found", { status: 404 });

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
