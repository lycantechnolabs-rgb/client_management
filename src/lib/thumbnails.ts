import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { readStoredFile } from "@/lib/files";
import { storage, storageIsRemote } from "@/lib/storage";

/**
 * Small versions of a grower's own photographs.
 *
 * Next's image optimiser cannot touch these. It fetches the source URL itself,
 * with no session, so `/api/files/[id]` hands it the same 404 a stranger gets —
 * which is exactly right, and the reason the gallery had to ask for full-size
 * originals. Twenty photographs straight off a phone is eighty megabytes into
 * a grid of thumbnails, over a hill connection.
 *
 * So the resizing happens here, behind the same ownership check, and the answer
 * is cached on disk. The gate does not move; only the size of what comes back.
 */

/**
 * The only widths that will ever be produced.
 *
 * An allowlist rather than a number from the query string, because each new
 * width is a CPU-bound encode and a cache entry that lives forever. Left open,
 * `?w=1`, `?w=2`, `?w=3`… is a cheap way to make the server do expensive work
 * and fill its disk. These four cover the grid at 1x and 2x and the lightbox.
 */
export const THUMB_WIDTHS = [200, 400, 800, 1200] as const;
export type ThumbWidth = (typeof THUMB_WIDTHS)[number];

export function isThumbWidth(value: number): value is ThumbWidth {
  return (THUMB_WIDTHS as readonly number[]).includes(value);
}

/** Nearest allowed width at or above what was asked for. */
export function clampWidth(requested: number): ThumbWidth {
  return (
    THUMB_WIDTHS.find((w) => w >= requested) ??
    THUMB_WIDTHS[THUMB_WIDTHS.length - 1]
  );
}

/**
 * What can be resized at all.
 *
 * SVG is deliberately absent. It is the one image type that is a document:
 * rasterising it means an XML parser resolving whatever the file asks for, and
 * these bytes came from outside. The seeded demo illustrations are SVG and are
 * already a few kilobytes, so they lose nothing by being served whole.
 */
const RESIZABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export function canThumbnail(mimeType: string | null | undefined) {
  return !!mimeType && RESIZABLE.has(mimeType);
}

const CACHE_DIR = path.join(process.cwd(), "private-uploads", ".thumbs");

/**
 * Cache path for one variant.
 *
 * The storage key is hashed rather than used directly: it arrives from a
 * database row, and a key with a slash in it — which S3 keys legitimately have
 * — would otherwise write outside the cache directory. A hash has no structure
 * to exploit, and collisions are not a concern at SHA-256.
 */
function cachePath(storageKey: string, width: number) {
  const digest = createHash("sha256").update(storageKey).digest("hex").slice(0, 32);
  return path.join(CACHE_DIR, `${digest}-${width}.webp`);
}

/** The original bytes, wherever they live. */
async function sourceBytes(storageKey: string, mimeType: string) {
  if (!storageIsRemote()) return readStoredFile(storageKey);

  // A bucket object. Fetching it to resize costs a round trip, but only on a
  // cache miss, and the result is a fraction of the size for every later view.
  const url = await storage().readUrl(storageKey, "thumb", mimeType);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

export type Thumbnail = { bytes: Buffer; contentType: string };

/**
 * A resized copy, from cache when possible.
 *
 * WebP rather than AVIF, which is the opposite of the choice made for the
 * public site. At 400px the absolute saving from AVIF is a couple of
 * kilobytes, while its encode is several times slower — and unlike the store's
 * hero images, these are encoded on demand for one viewer rather than once for
 * everyone. Cheap and small beats slow and slightly smaller here.
 *
 * Returns null when the source cannot be resized or has gone; the caller then
 * falls back to serving the original, which is always correct if larger.
 */
export async function getThumbnail(
  storageKey: string,
  mimeType: string,
  width: ThumbWidth,
): Promise<Thumbnail | null> {
  if (!canThumbnail(mimeType)) return null;

  const target = cachePath(storageKey, width);

  try {
    return { bytes: await readFile(target), contentType: "image/webp" };
  } catch {
    // Not cached yet.
  }

  const source = await sourceBytes(storageKey, mimeType);
  if (!source) return null;

  let out: Buffer;
  try {
    const sharp = (await import("sharp")).default;
    out = await sharp(source, { failOn: "error" })
      // `withoutEnlargement` so a photo already smaller than the grid is not
      // blown up into a bigger file than the original it came from.
      .resize({ width, withoutEnlargement: true })
      // Orientation lives in EXIF on anything from a phone; without this a
      // portrait photograph comes back on its side.
      .rotate()
      .webp({ quality: 78 })
      .toBuffer();
  } catch {
    // A corrupt or hostile file. Serving the original is not a fallback here —
    // the caller decides — but failing to resize must never be a 500.
    return null;
  }

  try {
    await mkdir(CACHE_DIR, { recursive: true });
    // Write then rename: two requests for the same missing thumbnail race, and
    // a half-written file read by the loser would be a broken image that stays
    // broken until something clears the cache. Rename is atomic.
    const staging = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(staging, out);
    await rename(staging, target);
  } catch {
    // An unwritable cache is a performance problem, not a correctness one.
  }

  return { bytes: out, contentType: "image/webp" };
}
