# Storage setup

The app uploads files straight from the browser to the bucket. That is the only
way past the 4.5 MB request-body cap on serverless platforms, and it is what
makes a 500 MB estate video possible.

---

## 0. What the capacity actually is

| | photos | video | PDFs |
|---|---|---|---|
| **`STORAGE_DRIVER=s3`** | 50 MB | 500 MB | 25 MB |
| **`local`, on your own server** | 50 MB | 500 MB | 25 MB |
| **`local`, on Vercel** | **off** | **off** | **off** |

The last row is not a setting anyone chose. A serverless host gives the app no
disk it can keep anything on: the deployment filesystem is read-only, and the
one writable path is per-instance and wiped between invocations. A grower's
photograph would fail to write, or land on one instance and be gone by the time
anyone asked for it back.

That is not a smaller version of working, so the app **switches uploads off**
there rather than offering a shrunken version of something broken, and logs
`[uploads] DISABLED` at startup. The rest of the portal — the work log, the
harvest, the costs, everything a grower actually signs in to see — carries on.

Separately, where files *do* pass through the app and something in front of it
caps the request body, the ceilings are clamped to fit and every part of the app
quotes the clamped number. That logs `[uploads] capacity reduced`.

**Configuring a bucket is what lifts it.** Nothing else does.

`npm run check:uploads` exercises that rule in every configuration.

The rest of this page is the bucket side. Two things must be right, and getting
either wrong fails in a way that looks like a bug in the app.

---

## 1. Environment

```
STORAGE_DRIVER="s3"
S3_BUCKET="aela-estate-files"
S3_REGION="ap-south-1"        # "auto" for R2 — the region is signed
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."

# Only for non-AWS. R2, MinIO and B2 address buckets by path rather than by
# subdomain, and the signature covers the path — so this is not cosmetic.
# S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
```

Set them all or none. A half-configured bucket is the case where uploads appear
to succeed and the files are not there, so the driver refuses to start with a
partial set and names what is missing.

Verify before trusting it:

```bash
npm run verify:s3
```

That writes one small object, reads it back and deletes it. If it fails, the app
will not upload.

---

## 2. CORS — the one that catches everyone

The browser sends the file to the bucket, not to this site, so the bucket must
allow requests from the site's origin. Without this the upload fails with a CORS
error in the console and nothing useful anywhere else, while
`npm run verify:s3` passes — because that runs from Node, which has no CORS.

**If uploads fail only in the browser, this is why.**

`PUT` is the method that matters, and `ETag` must be exposed or the browser
cannot read the response.

### AWS S3

Bucket → Permissions → Cross-origin resource sharing:

```json
[
  {
    "AllowedHeaders": ["content-type"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": [
      "https://your-domain.example",
      "http://localhost:3000"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### Cloudflare R2

R2 → your bucket → Settings → CORS policy. Same JSON.

**Setting R2 up from scratch: [r2-setup.md](r2-setup.md)** — the click path, the
two values everyone gets wrong, and what it costs.

Drop `http://localhost:3000` from the production bucket once you are done
testing — or better, keep a separate bucket for development.

---

## 3. The bucket must stay private

Do **not** make it public. Reads go through `/api/files/[id]`, which checks that
the person asking owns the file and then redirects to a URL signed for one
minute. A public bucket would make every grower's photographs readable by anyone
who learns an object key, and would silently undo the isolation the rest of the
app is built around.

No bucket policy granting `s3:GetObject` to `*`. No "static website hosting".

### Access key permissions

The key needs `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on
`arn:aws:s3:::<bucket>/*`, and nothing else. It does not need `s3:ListBucket`,
and it should not have access to any other bucket.

---

## 4. What to expect afterwards

- Uploads go to the bucket; nothing large passes through the app.
- Downloads are 302 redirects to a one-minute signed URL. That URL is a bearer
  token for its lifetime, which is why it is short and why the redirect is
  `no-store`.
- `private-uploads/` stops filling up. Files already there stay readable — the
  read path checks each attachment's own storage key, so old and new coexist.
  **There is no migration for existing files**; if the demo data matters, either
  keep `local` or re-upload.

## 5. Lifecycle, optional but worth it

Nothing deletes an object whose upload was abandoned — a grower who closes the
tab halfway leaves bytes with no attachment row pointing at them. A lifecycle
rule expiring incomplete multipart uploads and anything under `verify/` after a
day keeps that tidy. The retention purge handles rows, not orphans.
