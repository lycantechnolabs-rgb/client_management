import { randomUUID } from "node:crypto";
import { stat, unlink } from "node:fs/promises";
import path from "node:path";

import { extensionForType, resolveStoredPath } from "@/lib/files";
import { presign, type S3Config } from "@/lib/sigv4";

/**
 * Where uploaded bytes live, and how the browser gets them there.
 *
 * The shape is dictated by one constraint: on Vercel a request body is capped
 * at 4.5 MB, for Server Actions and route handlers alike. A 200 MB estate video
 * therefore cannot pass through this server at all. It has to go from the
 * browser to storage directly, which means the server's job changes from
 * *receiving* the file to *authorising* it:
 *
 *   1. the browser asks for a ticket, and gets one only if it may upload;
 *   2. the browser sends the bytes to the address on the ticket;
 *   3. the browser reports back, and the server verifies what actually landed.
 *
 * `local` is the default and needs no account. It hands out a URL on this same
 * server, which works because the 4.5 MB cap is a Vercel platform limit rather
 * than a Node one. It exercises the whole ticket flow, so the S3 driver has
 * nothing new to prove about the parts above and below it.
 */

export type UploadTarget = {
  /** Where the browser PUTs the bytes. */
  url: string;
  /** Headers the browser must send with the PUT, exactly. */
  headers: Record<string, string>;
  driver: string;
};

export type StorageDriver = {
  name: string;
  /** A storage key is always assigned here, never accepted from the client. */
  keyFor(filename: string, mimeType: string): string;
  target(token: string, key: string, mimeType: string): UploadTarget;
  /** Size of what actually arrived, or null if nothing did. */
  sizeOf(key: string): Promise<number | null>;
  remove(key: string): Promise<void>;
  /**
   * Where a reader should fetch this from, or null when the bytes are local
   * and should be streamed by the app itself.
   */
  readUrl(key: string, filename: string, mimeType: string): Promise<string | null>;
};

function keyFor(filename: string, mimeType: string) {
  // The visible name is kept on the attachment row; the stored name is random
  // so that nothing about it can be guessed or collided with.
  const ext = extensionForType(mimeType) || path.extname(filename) || "";
  return `${randomUUID()}${ext}`;
}

/* -------------------------------------------------------------------------- */
/* local                                                                       */
/* -------------------------------------------------------------------------- */

const localDriver: StorageDriver = {
  name: "local",
  keyFor,

  target(token) {
    // Relative on purpose: the browser resolves it against the origin it is
    // already on, so this works behind any hostname without configuration.
    return { url: `/api/upload/${token}`, headers: {}, driver: "local" };
  },

  async sizeOf(key) {
    const full = resolveStoredPath(key);
    if (!full) return null;
    try {
      return (await stat(full)).size;
    } catch {
      return null;
    }
  },

  async remove(key) {
    const full = resolveStoredPath(key);
    if (!full) return;
    try {
      await unlink(full);
    } catch {
      // already gone
    }
  },

  async readUrl() {
    // Served by /api/files/[id], which checks ownership and streams the bytes.
    return null;
  },
};

/* -------------------------------------------------------------------------- */
/* s3                                                                          */
/* -------------------------------------------------------------------------- */

/** How long a presigned upload URL is good for. */
const PUT_TTL_SECONDS = 60 * 60;

/**
 * How long a presigned download URL is good for.
 *
 * Short, because once issued it is a bearer token: anyone holding that URL can
 * fetch the object until it expires, with no further check. A minute is enough
 * for a browser to start the request — including a video player, which reissues
 * as it seeks — and short enough that a URL copied out of a log or a shared
 * screenshot is useless by the time anyone tries it.
 */
const GET_TTL_SECONDS = 60;

function s3Config(): S3Config {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  const missing = [
    !bucket && "S3_BUCKET",
    !region && "S3_REGION",
    !accessKeyId && "S3_ACCESS_KEY_ID",
    !secretAccessKey && "S3_SECRET_ACCESS_KEY",
  ].filter(Boolean);

  // Fail loudly and completely. A half-configured bucket is the case where
  // uploads appear to work and the files are not there.
  if (missing.length > 0) {
    throw new Error(
      `STORAGE_DRIVER=s3 but ${missing.join(", ")} ${
        missing.length === 1 ? "is" : "are"
      } not set.`,
    );
  }

  return {
    bucket: bucket!,
    region: region!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    sessionToken: process.env.S3_SESSION_TOKEN,
    // Set for R2, MinIO, B2 — anything addressing buckets by path.
    endpoint: process.env.S3_ENDPOINT,
  };
}

const s3Driver: StorageDriver = {
  name: "s3",
  keyFor,

  target(_token, key, mimeType) {
    const url = presign(s3Config(), {
      method: "PUT",
      key,
      expiresIn: PUT_TTL_SECONDS,
      // Signed, so the browser must send exactly this. A ticket issued for a
      // photograph cannot be spent on something else.
      contentType: mimeType,
    });

    return {
      url,
      headers: { "content-type": mimeType },
      driver: "s3",
    };
  },

  async sizeOf(key) {
    const url = presign(s3Config(), {
      method: "HEAD",
      key,
      expiresIn: 60,
    });
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) return null;
    const length = res.headers.get("content-length");
    return length ? Number(length) : null;
  },

  async remove(key) {
    const url = presign(s3Config(), {
      method: "DELETE",
      key,
      expiresIn: 60,
    });
    await fetch(url, { method: "DELETE" });
  },

  async readUrl(key, filename, mimeType) {
    return presign(s3Config(), {
      method: "GET",
      key,
      expiresIn: GET_TTL_SECONDS,
      query: {
        // The bucket knows nothing about the original filename or how it
        // should be presented; both come from our row.
        "response-content-type": mimeType || "application/octet-stream",
        "response-content-disposition": `inline; filename="${encodeURIComponent(filename)}"`,
      },
    });
  },
};

const DRIVERS: Record<string, StorageDriver> = {
  local: localDriver,
  s3: s3Driver,
};

export function storage(): StorageDriver {
  const name = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
  return DRIVERS[name] ?? localDriver;
}

export function storageName() {
  return (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
}

/** True when the bytes live somewhere this app does not serve directly. */
export function storageIsRemote() {
  return storageName() === "s3";
}
