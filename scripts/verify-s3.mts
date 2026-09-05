/**
 * A real round trip against a real bucket.
 *
 * The presigner is checked against AWS's published key-derivation vector in the
 * security suite, and its structure is checked there too — but neither of those
 * proves a bucket will accept the signature. Nothing does, short of asking one.
 * This does that, and it is the thing to run first when uploads start failing.
 *
 *   npm run verify:s3
 *
 * Needs the same environment the app uses: STORAGE_DRIVER=s3 plus S3_BUCKET,
 * S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_ENDPOINT for
 * anything that is not AWS.
 *
 * It writes one small object, reads it back, and deletes it.
 */
import { presign, type S3Config } from "../src/lib/sigv4.ts";

function config(): S3Config | null {
  const required = [
    "S3_BUCKET",
    "S3_REGION",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ] as const;

  // All of them, not the first one. Reporting them one run at a time turns a
  // single mistake into four rounds of edit-and-rerun.
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(
      `\n  Not configured: ${missing.join(", ")}.\n\n` +
        `  These are read from .env (or the shell). For Cloudflare R2, where\n` +
        `  each of them comes from is in docs/r2-setup.md.\n`,
    );
    return null;
  }

  return {
    bucket: process.env.S3_BUCKET!,
    region: process.env.S3_REGION!,
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    sessionToken: process.env.S3_SESSION_TOKEN,
    endpoint: process.env.S3_ENDPOINT,
  };
}

const cfg = config();
// Not process.exit(): exiting while stdio is still flushing aborts the process
// on Windows, and a plain configuration message should not look like a crash.
if (!cfg) {
  process.exitCode = 1;
} else {
  try {
    await roundTrip(cfg);
  } catch (error) {
    // A wrong account id in the endpoint fails here as DNS or TLS, not as a
    // rejected signature. Uncaught, that arrives as a stack trace and reads
    // like a broken script rather than a wrong address.
    console.error(
      `\n  Could not reach ${cfg.endpoint ?? "the bucket"}.\n\n` +
        `  ${error instanceof Error ? error.message : String(error)}\n\n` +
        `  Check S3_ENDPOINT — an account id that is off by a character looks\n` +
        `  exactly like this. It should be the origin alone, no bucket, no path.\n`,
    );
    process.exitCode = 1;
  }
}

async function roundTrip(cfg: S3Config) {
  const key = `verify/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
  const body = `aela storage check ${new Date().toISOString()}`;
  const contentType = "text/plain";

  let failed = false;
  const step = (name: string, ok: boolean, detail = "") => {
    if (!ok) failed = true;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  };

  console.log(`\nBucket ${cfg.bucket} (${cfg.region})${cfg.endpoint ? ` at ${cfg.endpoint}` : ""}`);
  console.log(`Object ${key}\n`);

  /* 0. the mistakes that cost an afternoon, named before the request is sent */
  if (/r2\.cloudflarestorage\.com/.test(cfg.endpoint ?? "")) {
    if (cfg.region !== "auto") {
      console.log(
        `  NOTE  S3_REGION is "${cfg.region}". R2 expects "auto", and the region\n` +
          `        is part of what gets signed — a 401 below is probably this.\n`,
      );
    }
    if (new URL(cfg.endpoint!).pathname.replace(/\/$/, "") !== "") {
      console.log(
        `  NOTE  S3_ENDPOINT has a path on it. The R2 dashboard shows the bucket\n` +
          `        appended; use the account origin alone and leave the bucket to\n` +
          `        S3_BUCKET. Ignored here, but it will confuse the next reader.\n`,
      );
    }
  }

  /* 1. upload */
  const putUrl = presign(cfg, { method: "PUT", key, expiresIn: 300, contentType });
  const put = await fetch(putUrl, {
    method: "PUT",
    headers: { "content-type": contentType },
    body,
  });
  step("presigned PUT accepted", put.ok, `status ${put.status}`);
  if (!put.ok) {
    const detail = await put.text();
    console.log(`\n${detail.slice(0, 600)}\n`);
    console.log(
      "  A 403 here is usually the clock, the region, or the secret. A CORS\n" +
        "  error in the browser but a pass here means the bucket's CORS rules\n" +
        "  need the site's origin — see docs/storage.md.\n",
    );
    process.exitCode = 1;
    return;
  }

  /* 2. size, the way completeUpload checks it */
  const headUrl = presign(cfg, { method: "HEAD", key, expiresIn: 60 });
  const head = await fetch(headUrl, { method: "HEAD" });
  const length = Number(head.headers.get("content-length") ?? 0);
  step("HEAD returns the size", head.ok && length === body.length, `${length} bytes`);

  /* 3. read back, the way a grower's browser will */
  const getUrl = presign(cfg, {
    method: "GET",
    key,
    expiresIn: 60,
    query: { "response-content-type": contentType },
  });
  const get = await fetch(getUrl);
  const read = get.ok ? await get.text() : "";
  step("presigned GET returns the same bytes", read === body);

  /* 4. clean up */
  const delUrl = presign(cfg, { method: "DELETE", key, expiresIn: 60 });
  const del = await fetch(delUrl, { method: "DELETE" });
  step("DELETE removes it", del.ok || del.status === 204, `status ${del.status}`);

  const gone = await fetch(presign(cfg, { method: "HEAD", key, expiresIn: 60 }), {
    method: "HEAD",
  });
  step("the object is gone afterwards", gone.status === 404, `status ${gone.status}`);

  console.log(
    failed
      ? "\nSomething is wrong — the app will not upload until this passes.\n"
      : "\nStorage is working. Set STORAGE_DRIVER=s3 and uploads will use it.\n",
  );
  if (failed) process.exitCode = 1;
}
