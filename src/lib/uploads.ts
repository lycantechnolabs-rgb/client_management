import { writeStoredFile } from "@/lib/files";
import {
  ALLOWED,
  MAX_INLINE_BYTES,
  kindOf,
  type UploadKind,
} from "@/lib/upload-limits";

/**
 * Storing an uploaded file. Server only — it writes to disk.
 *
 * Shared by Jinto's work-log form and the growers' own uploads on purpose: two
 * copies of this would drift, and the copy that drifted would be the one that
 * accepted something it should not have. A grower's file goes through exactly
 * the checks Jinto's does.
 *
 * The limits and the accepted types live in src/lib/upload-limits.ts, which has
 * no runtime dependencies, so the browser can check them before sending without
 * dragging `node:fs/promises` into the client bundle.
 */

export { ALLOWED, MAX_INLINE_BYTES, type UploadKind };

export type StoredUpload = {
  kind: UploadKind;
  url: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

/**
 * Store an upload privately and describe the row to create for it.
 *
 * The bytes go to private-uploads/, never public/ — see src/lib/files.ts.
 * Readers reach them through /api/files/<attachment id>, which checks that the
 * signed-in grower owns the attachment.
 *
 * `only` narrows what this particular caller will take. The photo picker on the
 * grower's gallery passes ["IMAGE", "VIDEO"], so a PDF renamed to .jpg is
 * refused here rather than filed under the wrong heading — the browser's
 * `accept` attribute is a convenience for the person choosing, not a check.
 */
export async function saveUpload(
  file: File,
  only?: readonly UploadKind[],
): Promise<StoredUpload | null> {
  if (file.size === 0) return null;
  if (file.size > MAX_INLINE_BYTES) {
    throw new Error(
      `${file.name} is larger than ${Math.round(MAX_INLINE_BYTES / 1024 / 1024)} MB.`,
    );
  }

  const kind = kindOf(file.type);
  if (!kind) throw new Error(`${file.name} is not an accepted file type.`);
  if (only && !only.includes(kind)) {
    throw new Error(`${file.name} is not the right kind of file for this.`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storageKey = await writeStoredFile(bytes, file.type);

  return {
    kind,
    url: "",
    storageKey,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}
