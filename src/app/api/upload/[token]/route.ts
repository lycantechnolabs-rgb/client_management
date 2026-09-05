import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { once } from "node:events";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";

import { db } from "@/lib/db";
import { resolveStoredPath } from "@/lib/files";

/**
 * Where the bytes land for the local storage driver.
 *
 * A route handler rather than a Server Action because the body here is the
 * whole file — hundreds of megabytes for an estate video — and it is streamed
 * to disk rather than buffered. Reading it into memory first would work on a
 * laptop and fall over on anything real.
 *
 * Authentication is the ticket in the URL, not the session. That is deliberate:
 * the ticket already encodes who may upload, what kind, how large and under
 * which key, all decided while the session was in hand. It is random, single
 * use and short lived, and it is the same shape a presigned S3 URL has — so the
 * browser code does not change when the driver does.
 *
 * The ticket is not consumed here. Completion is a separate step that verifies
 * what actually arrived; this endpoint's only job is to receive it.
 */
/**
 * Delete a half-written file, once the handle writing it is actually closed.
 *
 * Windows refuses to unlink a file that is still open, and `pipeline` rejects
 * before the stream has finished closing — so an unlink issued straight away
 * fails, and a swallowed failure leaves exactly the partial file this is meant
 * to prevent. Wait for `close`, then remove it, then confirm.
 *
 * If it still cannot be removed the request fails rather than reporting a
 * tidy-up that did not happen; the orphan is then a stale ticket pointing at a
 * short file, which completion rejects on size.
 */
async function discard(full: string, sink: WriteStream) {
  if (!sink.closed) {
    sink.destroy();
    await once(sink, "close").catch(() => {});
  }
  await unlink(full).catch(() => {});
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const ticket = await db.uploadTicket.findUnique({
    where: { token },
    select: {
      status: true,
      expiresAt: true,
      storageKey: true,
      maxBytes: true,
    },
  });

  if (!ticket || ticket.status !== "ISSUED" || ticket.expiresAt < new Date()) {
    return new Response("Not found", { status: 404 });
  }

  const full = resolveStoredPath(ticket.storageKey);
  if (!full) return new Response("Not found", { status: 404 });

  if (!request.body) return new Response("No body", { status: 400 });

  await mkdir(path.dirname(full), { recursive: true });

  // Counted as it streams. A declared Content-Length can lie, and a body with
  // no length at all is perfectly legal, so the cap is enforced against what
  // actually passes through rather than what was announced.
  let written = 0;
  let overLimit = false;
  const sink = createWriteStream(full);

  try {
    await pipeline(
      Readable.fromWeb(request.body as never),
      async function* (chunks: AsyncIterable<Buffer>) {
        for await (const chunk of chunks) {
          written += chunk.length;
          if (written > ticket.maxBytes) {
            overLimit = true;
            throw new Error("over limit");
          }
          yield chunk;
        }
      },
      sink,
    );
  } catch {
    // A partial file is worse than none: under the cap it would pass the
    // completion check on size alone and be filed as a real attachment.
    await discard(full, sink);
    return new Response(
      overLimit ? "File is larger than the limit." : "Upload failed.",
      { status: overLimit ? 413 : 500 },
    );
  }

  return Response.json({ ok: true, bytes: written });
}
