// Server only. Not marked with the `server-only` package — it is not a
// dependency here — but importing this from a client component pulls
// node:fs/promises in through @/lib/storage and fails the build, which is the
// same outcome by a blunter route. Client code takes these numbers as props.
import { storageIsRemote, storageName } from "@/lib/storage";
import {
  PLATFORM_BODY_LIMIT_BYTES,
  computeCapacity,
  type UploadKind,
} from "@/lib/upload-limits";

/**
 * How large an upload can actually be, on this deployment, right now.
 *
 * The ceilings in upload-limits.ts are what the product intends. This reads the
 * environment to decide what can actually be honoured. The rule itself lives
 * with the limits — see computeCapacity — so it can be tested without a
 * filesystem or a bucket.
 */

/**
 * True when the request body passes through a platform that caps it.
 *
 * Vercel sets VERCEL=1 in every runtime it runs. Any other host that proxies
 * through a similar cap can declare it with UPLOAD_BODY_LIMIT_BYTES.
 */
function platformBodyLimit(): number | null {
  const declared = process.env.UPLOAD_BODY_LIMIT_BYTES;
  if (declared) {
    const bytes = Number(declared);
    return Number.isFinite(bytes) && bytes > 0 ? bytes : null;
  }
  return process.env.VERCEL ? PLATFORM_BODY_LIMIT_BYTES : null;
}

/**
 * Whether a file written to this server's disk would still be there later.
 *
 * On Vercel it would not: the deployment filesystem is read-only, and the one
 * writable path is per-instance and wiped between invocations. Any other host
 * with the same property can say so with UPLOAD_DISK_IS_EPHEMERAL=1.
 */
function localDiskPersists(): boolean {
  return !process.env.VERCEL && process.env.UPLOAD_DISK_IS_EPHEMERAL !== "1";
}

export function uploadCapacity() {
  return computeCapacity(
    storageIsRemote(),
    storageName(),
    platformBodyLimit(),
    localDiskPersists(),
  );
}

/** The effective ceiling for one kind. */
export function effectiveMaxBytes(kind: UploadKind) {
  return uploadCapacity().limits[kind];
}

// Said once, at startup, where whoever deployed it will see it. A grower is
// never told about storage drivers; they are only ever shown the true number.
{
  const capacity = uploadCapacity();
  if (!capacity.available) {
    // An error, not a warning: growers cannot upload at all until this is
    // fixed, and nothing in the interface will say so.
    console.error(`[uploads] DISABLED — ${capacity.reason}`);
  } else if (capacity.constrained) {
    console.warn(`[uploads] capacity reduced — ${capacity.reason}`);
  }
}
