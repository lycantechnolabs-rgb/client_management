import { MAX_INLINE_BYTES } from "@/lib/upload-limits";

/**
 * Shrink photographs in the browser before they are uploaded.
 *
 * Runs in the browser only — it needs canvas.
 *
 * Two problems, one fix. A Server Action carries its whole payload in the
 * request body, and that body has a hard ceiling: 1 MB by default, and 4.5 MB
 * on Vercel's serverless platform whatever Next is configured to allow. A phone
 * photograph is three to six megabytes, so every upload from the field was
 * hitting the wall.
 *
 * The other problem is the one that matters more day to day: a grower standing
 * on a hillside on a patchy connection should not be pushing six megabytes up
 * to prove a round was picked. A 1920px WebP of the same photograph is around
 * a quarter of a megabyte and looks identical on the phone it will be viewed on.
 *
 * The trade is that the original is not kept. For photographs whose job is to
 * show what was done on an estate that is the right way round; if full-
 * resolution originals are ever needed, they need direct-to-storage uploads
 * rather than a bigger body limit, because no body limit reaches 25 MB.
 */

/** Longest edge after resizing. Comfortably past any phone screen. */
export const MAX_IMAGE_EDGE = 1920;

const QUALITY = 0.82;

/** Below this, re-encoding usually makes the file bigger, not smaller. */
const SKIP_BELOW_BYTES = 400 * 1024;

const COMPRESSIBLE = ["image/jpeg", "image/png", "image/webp"];

function canCompress(file: File) {
  return COMPRESSIBLE.includes(file.type) && file.size > SKIP_BELOW_BYTES;
}

async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(
    1,
    MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", QUALITY),
  );
  if (!blob) return file;

  // If the round trip did not actually help, keep the original.
  if (blob.size >= file.size) return file;

  const renamed = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], renamed, {
    type: "image/webp",
    lastModified: file.lastModified,
  });
}

export type PreparedFiles = {
  files: File[];
  /** Set when something cannot be sent, with a sentence to show the user. */
  error?: string;
  /** Bytes saved, so the form can say what it did. */
  savedBytes: number;
};

/**
 * Compress what can be compressed, then check the whole batch will fit.
 *
 * Checked here rather than only on the server because the body limit is
 * enforced by the framework *before* any of our code runs — an oversized
 * upload does not reach the action to be refused politely, it throws a runtime
 * error page. The only place to catch it kindly is before it is sent.
 */
export async function prepareFiles(input: File[]): Promise<PreparedFiles> {
  const before = input.reduce((sum, f) => sum + f.size, 0);
  const out: File[] = [];

  for (const file of input) {
    if (!canCompress(file)) {
      out.push(file);
      continue;
    }
    try {
      out.push(await shrink(file));
    } catch {
      // A format the browser will not decode. Send it as it is and let the
      // size check below decide.
      out.push(file);
    }
  }

  const after = out.reduce((sum, f) => sum + f.size, 0);

  const limitMB = Math.round(MAX_INLINE_BYTES / 1024 / 1024);

  const tooBig = out.find((f) => f.size > MAX_INLINE_BYTES);
  if (tooBig) {
    // "after compressing" is only true of a photograph. A PDF was never
    // compressed, and telling someone it was would send them looking for a
    // setting that does not exist.
    const wasCompressed = tooBig.type === "image/webp";
    return {
      files: out,
      savedBytes: before - after,
      error: wasCompressed
        ? `${tooBig.name} is still ${(tooBig.size / 1024 / 1024).toFixed(1)} MB after shrinking, which is over the ${limitMB} MB limit. Ask Jinto to add it.`
        : `${tooBig.name} is ${(tooBig.size / 1024 / 1024).toFixed(1)} MB, over the ${limitMB} MB limit. Photos are shrunk automatically, but this kind of file is not — ask Jinto to add it.`,
    };
  }

  if (after > MAX_INLINE_BYTES) {
    return {
      files: out,
      savedBytes: before - after,
      error: `Those files come to ${(after / 1024 / 1024).toFixed(1)} MB together, which is more than one upload can carry. Send them in smaller batches.`,
    };
  }

  return { files: out, savedBytes: before - after };
}
