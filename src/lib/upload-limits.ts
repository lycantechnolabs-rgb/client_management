/**
 * Upload rules that both sides need to agree on.
 *
 * Split from src/lib/uploads.ts because that module reaches for
 * `node:fs/promises`, and the browser needs these numbers too. Importing the
 * server module from client code pulled `node:fs/promises` into the browser
 * bundle, which Turbopack reports as a panic rather than a readable error.
 *
 * Nothing in this file may import anything with a runtime dependency.
 */

/**
 * Per-kind ceilings for direct-to-storage uploads.
 *
 * These are real limits now rather than an artefact of the transport. Files go
 * from the browser straight to storage without passing through a Server Action,
 * so the 4.5 MB request-body cap that used to govern everything no longer
 * applies — what remains is what is sensible to keep and to serve.
 *
 * Video is the reason this exists: a minute of 1080p from a phone is 60–100 MB,
 * and a walk round an estate is several minutes.
 */
export const MAX_BYTES = {
  IMAGE: 50 * 1024 * 1024, // 50 MB — well past any phone camera original
  VIDEO: 500 * 1024 * 1024, // 500 MB — a few minutes of 1080p
  DOCUMENT: 25 * 1024 * 1024, // 25 MB — scanned reports run large
} as const;

/**
 * The old single limit, kept for the one path that still goes through a Server
 * Action: Jinto's work-log form posts its photos with the rest of the entry, so
 * those are still bounded by the request body.
 */
export const MAX_INLINE_BYTES = 4 * 1024 * 1024;

/**
 * What a serverless platform will carry in a single request body.
 *
 * Vercel's cap, and the reason the ceilings above are only real once the files
 * stop passing through this server. The `local` driver hands the browser a URL
 * on this same origin, so on a serverless host it is still governed by this —
 * a 200 MB video sent there is rejected by the platform before any of our code
 * runs, with an error that says nothing useful.
 *
 * Running `next dev` or a plain Node server has no such cap; this applies only
 * where the platform imposes it. See uploadCapacity() in upload-capacity.ts.
 */
export const PLATFORM_BODY_LIMIT_BYTES = Math.floor(4.5 * 1024 * 1024);

// SVG is deliberately absent: it is an XML document that can carry <script>,
// and anything served from this origin can read the session cookie. Raster
// formats only for uploads.
export const ALLOWED = {
  IMAGE: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  VIDEO: ["video/mp4", "video/quicktime", "video/webm"],
  DOCUMENT: ["application/pdf"],
} as const;

export type UploadKind = keyof typeof ALLOWED;

/** For the `accept` attribute, so the picker offers the right files. */
export const ACCEPT: Record<UploadKind, string> = {
  IMAGE: ALLOWED.IMAGE.join(","),
  VIDEO: ALLOWED.VIDEO.join(","),
  DOCUMENT: ALLOWED.DOCUMENT.join(","),
};

export const ACCEPT_MEDIA = `${ACCEPT.IMAGE},${ACCEPT.VIDEO}`;

export function kindOf(mimeType: string): UploadKind | null {
  for (const kind of Object.keys(ALLOWED) as UploadKind[]) {
    if ((ALLOWED[kind] as readonly string[]).includes(mimeType)) return kind;
  }
  return null;
}

export function maxBytesFor(kind: UploadKind) {
  return MAX_BYTES[kind];
}

export function formatBytes(bytes: number) {
  const mb = bytes / 1024 / 1024;
  // Below 10 MB a rounded whole number starts to lie by a noticeable fraction,
  // and this number is the one a grower is measured against.
  return `${mb < 10 ? Math.round(mb * 10) / 10 : Math.round(mb)} MB`;
}

export function describeLimit(kind: UploadKind) {
  return formatBytes(MAX_BYTES[kind]);
}

/** The effective ceilings, as sent from the server to the upload form. */
export type UploadLimits = Record<UploadKind, number>;

export type UploadCapacity = {
  limits: UploadLimits;
  /** False when this deployment cannot store an upload at all. */
  available: boolean;
  /** True when it can, but not at the intended ceilings. */
  constrained: boolean;
  /** Operator-facing explanation, null when nothing is wrong. */
  reason: string | null;
};

/**
 * What this deployment can actually store, given how storage is configured.
 *
 * The ceilings above are the intent. Two separate facts about a host can stop
 * them being real, and they are genuinely different problems:
 *
 * **The disk does not persist.** On a serverless host the `local` driver has
 * nowhere to write: the deployment filesystem is read-only, and the one
 * writable path is per-instance and wiped between invocations. A photograph
 * would fail to write, or land on one instance and be gone by the time anyone
 * asked for it back. That is not a smaller version of working — so uploads are
 * switched off rather than offered at a reduced size. The portal's main job,
 * showing a grower what was done on their estate, carries on unaffected.
 *
 * **The request body is capped.** Where files pass through this server and
 * something in front of it limits the body, the ceilings are clamped to fit and
 * every part of the app quotes the clamped number, so an oversize file is
 * refused by us in a sentence a person can act on rather than by the platform
 * in one they cannot.
 *
 * Configuring a bucket resolves both: the bytes then go from the browser
 * straight to storage and never touch this server.
 *
 * Pure on purpose — the environment is read by uploadCapacity() in
 * upload-capacity.ts. Reading a driver and an env var in here would make this
 * testable only in the configuration the test process happens to be in, which
 * is the one configuration that never breaks.
 */
export function computeCapacity(
  remote: boolean,
  driverName: string,
  bodyLimit: number | null,
  localDiskPersists: boolean,
): UploadCapacity {
  const kinds = Object.keys(MAX_BYTES) as UploadKind[];
  const none = Object.fromEntries(kinds.map((k) => [k, 0])) as UploadLimits;

  // Nowhere to put the bytes. Refuse plainly rather than accept a file that
  // will not survive the request that delivered it.
  if (!remote && !localDiskPersists) {
    return {
      limits: none,
      available: false,
      constrained: true,
      reason:
        `STORAGE_DRIVER=${driverName} on a host with no persistent disk: an ` +
        `uploaded file would not survive the request that delivered it, so ` +
        `uploads are switched off. Configure a bucket — see docs/r2-setup.md.`,
    };
  }

  // Remote storage takes the bytes directly; nothing passes through this
  // server, so a body cap in front of it does not apply.
  if (remote || bodyLimit === null) {
    return {
      limits: { ...MAX_BYTES },
      available: true,
      constrained: false,
      reason: null,
    };
  }

  const limits = Object.fromEntries(
    kinds.map((kind) => [kind, Math.min(MAX_BYTES[kind], bodyLimit)]),
  ) as UploadLimits;

  // A body limit generous enough to carry the intended ceilings constrains
  // nothing, and saying otherwise sends someone hunting a problem they cannot
  // find.
  const constrained = kinds.some((kind) => limits[kind] < MAX_BYTES[kind]);

  return {
    limits,
    available: true,
    constrained,
    reason: constrained
      ? `STORAGE_DRIVER=${driverName}: uploads pass through this app and are ` +
        `capped at ${formatBytes(bodyLimit)} by the request body limit in ` +
        `front of it. Configure a bucket to lift it — see docs/storage.md.`
      : null,
  };
}

/** How long a browser has to finish an upload once a ticket is issued. */
export const TICKET_TTL_MINUTES = 60;
