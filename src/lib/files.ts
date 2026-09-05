import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Private file storage for client attachments.
 *
 * Anything a grower uploads — estate photos, lab reports, invoices, licences —
 * lands here and NOT in public/. public/ is served straight off the filesystem
 * with no session check, so a document there is readable by anyone who learns
 * the URL. Bytes in this directory are only reachable through
 * /api/files/<attachment id>, which re-checks ownership on every request.
 *
 * In production this whole module becomes Cloudinary with private assets and
 * signed, expiring URLs. The route stays; only the two functions below change.
 */
const ROOT = path.join(process.cwd(), "private-uploads");

/** The extension is chosen by us from the validated MIME type, never from the
 * uploaded filename — "photo.html" declaring image/jpeg must not become HTML. */
const EXTENSION_FOR_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/svg+xml": ".svg", // seed placeholders only; uploads reject SVG
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "application/pdf": ".pdf",
};

export function extensionForType(mimeType: string) {
  return EXTENSION_FOR_TYPE[mimeType] ?? ".bin";
}

/**
 * Resolve a storage key to a path inside ROOT, or null if it escapes.
 * Keys we mint are UUIDs, but this function is the last line of defence for
 * anything that reaches it from a request, so it validates rather than trusts.
 */
export function resolveStoredPath(storageKey: string) {
  if (!storageKey || storageKey.includes("\0")) return null;
  const full = path.resolve(ROOT, storageKey);
  const root = path.resolve(ROOT);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

/** Write bytes privately and return the key to store on the Attachment. */
export async function writeStoredFile(bytes: Buffer, mimeType: string) {
  await mkdir(ROOT, { recursive: true });
  const storageKey = `${randomUUID()}${extensionForType(mimeType)}`;
  await writeFile(path.join(ROOT, storageKey), bytes);
  return storageKey;
}

export async function readStoredFile(storageKey: string) {
  const full = resolveStoredPath(storageKey);
  if (!full) return null;
  try {
    return await readFile(full);
  } catch {
    return null;
  }
}

/**
 * Remove the bytes behind an attachment.
 *
 * Goes through resolveStoredPath like every other reader, so a malformed or
 * traversing key deletes nothing rather than something it should not.
 *
 * A missing file is treated as success: the caller has already removed the row
 * that pointed here, and failing the whole operation because the bytes were
 * gone already would leave the database and the disk disagreeing in the more
 * confusing direction — a row for a file nobody can read.
 */
export async function deleteStoredFile(storageKey: string | null) {
  if (!storageKey) return;
  const full = resolveStoredPath(storageKey);
  if (!full) return;
  try {
    await unlink(full);
  } catch {
    // already gone
  }
}

/**
 * Where the browser should fetch this attachment from. Privately stored files
 * go through the authorizing route; older rows keep their public path.
 */
export function attachmentHref(a: { id: string; storageKey?: string | null; url: string }) {
  return a.storageKey ? `/api/files/${a.id}` : a.url;
}

/**
 * Where to fetch a *small* copy of a photograph.
 *
 * Only for privately stored images: an older row with a public `url` is served
 * as it always was, and anything that is not a photograph has no thumbnail.
 * Returns null when there is none, so the caller falls back to the original
 * rather than requesting a URL that will 404.
 */
export function thumbnailHref(
  a: {
    id: string;
    storageKey?: string | null;
    kind?: string | null;
    mimeType?: string | null;
  },
  width: number,
) {
  if (!a.storageKey || a.kind !== "IMAGE") return null;
  // SVG is not resized — see src/lib/thumbnails.ts — so asking would 404.
  if (a.mimeType === "image/svg+xml") return null;
  return `/api/thumb/${a.id}?w=${width}`;
}
