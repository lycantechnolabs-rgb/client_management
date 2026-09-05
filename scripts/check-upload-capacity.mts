/**
 * The upload capacity rule, exercised in every configuration it can be in.
 *
 * Worth a real run rather than a pattern match, because the failure this guards
 * against is silent: a form promising 500 MB on a deployment whose platform
 * refuses anything over 4.5 MB. That looks like a broken app, and it looked
 * exactly like one the first time it happened.
 *
 *   node --experimental-strip-types scripts/check-upload-capacity.mts
 */
import {
  MAX_BYTES,
  PLATFORM_BODY_LIMIT_BYTES,
  computeCapacity,
  formatBytes,
} from "../src/lib/upload-limits.ts";

const CAP = PLATFORM_BODY_LIMIT_BYTES;

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

console.log("\nUpload capacity\n");

/* A laptop, or any host with a real disk. */
const ownServer = computeCapacity(false, "local", null, true);
check(
  "local storage on its own server keeps the full ceilings",
  ownServer.limits.VIDEO === MAX_BYTES.VIDEO && !ownServer.constrained,
  formatBytes(ownServer.limits.VIDEO),
);

/* The case that used to fail opaquely: nowhere to put the bytes at all. */
const ephemeral = computeCapacity(false, "local", CAP, false);
check(
  "local storage with no persistent disk is switched off, not shrunk",
  !ephemeral.available && ephemeral.limits.VIDEO === 0,
);
check(
  "and says so, naming where the fix is written down",
  /docs\/r2-setup\.md/.test(ephemeral.reason ?? ""),
);

/* A real disk behind something that caps the request body. */
const capped = computeCapacity(false, "local", CAP, true);
check(
  "a capped request body clamps the ceilings but keeps uploads working",
  capped.available && capped.limits.VIDEO === CAP && capped.constrained,
  formatBytes(capped.limits.VIDEO),
);

/* What the bucket is for. */
const bucket = computeCapacity(true, "s3", CAP, false);
check(
  "a bucket restores the full ceilings even with no disk and a capped body",
  bucket.available &&
    bucket.limits.VIDEO === MAX_BYTES.VIDEO &&
    !bucket.constrained,
  formatBytes(bucket.limits.VIDEO),
);

/* A limit above the ceilings is not a constraint. */
const roomy = computeCapacity(false, "local", 10 * 1024 * 1024 * 1024, true);
check(
  "a body limit larger than the ceilings constrains nothing",
  !roomy.constrained && roomy.limits.VIDEO === MAX_BYTES.VIDEO,
);

/* The number a grower reads. */
check("4.5 MB is not rounded to 4 MB", formatBytes(CAP) === "4.5 MB", formatBytes(CAP));
check(
  "larger figures stay whole",
  formatBytes(MAX_BYTES.VIDEO) === "500 MB",
  formatBytes(MAX_BYTES.VIDEO),
);

console.log(failed ? `\n${failed} failed.\n` : "\nAll passed.\n");
process.exit(failed ? 1 : 0);
