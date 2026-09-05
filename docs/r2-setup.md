# Setting up the R2 bucket

Fifteen minutes, in the Cloudflare dashboard. Everything here needs your
Cloudflare account, so it has to be done by you — the application side is
already finished and waiting for the four values at the end.

R2 rather than S3 for one reason: **Cloudflare charges nothing for egress.**
This portal serves video, and on S3 every grower who watches a 200 MB estate
video costs money on the way out. On R2 that is free; you pay for what is
stored and for the requests.

---

## 1. Create the bucket

Cloudflare dashboard → **R2** → **Create bucket**.

- **Name:** `aela-estate-files`
- **Location:** Automatic, or **Asia-Pacific** if offered — the growers and the
  estate are in Kerala.
- **Leave public access OFF.** This matters; see §5.

Note the **Account ID** shown on the R2 overview page. You need it for the
endpoint.

---

## 2. Create an API token

R2 → **Manage R2 API Tokens** → **Create API token**.

- **Permissions:** *Object Read & Write*
- **Specify bucket:** `aela-estate-files` — not "all buckets". If this key ever
  leaks, it should reach one bucket and nothing else.
- **TTL:** forever is fine; rotating it is a two-minute job when you want to.

Cloudflare then shows you, once:

- **Access Key ID**
- **Secret Access Key**
- **Endpoint** — `https://<account-id>.r2.cloudflarestorage.com`

**Copy all three now.** The secret is not shown again; losing it means making a
new token, which is not a disaster, just annoying.

---

## 3. Put them in the environment

Locally, in `.env`. On Vercel, in **Settings → Environment Variables**.

```
STORAGE_DRIVER="s3"
S3_BUCKET="aela-estate-files"
S3_REGION="auto"
S3_ACCESS_KEY_ID="<access key id>"
S3_SECRET_ACCESS_KEY="<secret access key>"
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
```

Two things people get wrong here, both of which produce a bare `401` with no
explanation:

- **`S3_REGION` must be `auto`.** Not `ap-south-1`, not `apac`. The region is
  part of what the signature is computed over, so a plausible-looking wrong
  value fails exactly like a wrong password.
- **`S3_ENDPOINT` is the account origin, with no bucket on the end.** The
  dashboard shows it with the bucket appended; drop that part. The bucket
  belongs in `S3_BUCKET`.

Then, from `cardamom-portal/`:

```bash
npm run verify:s3
```

That writes one small object, reads it back, compares the bytes and deletes it.
It also warns about the two mistakes above before it even sends a request. If it
passes, storage works. If it fails, the app will not upload, and fixing it here
is much easier than debugging it through a browser.

---

## 4. CORS — do not skip this

The browser sends the file **to the bucket, not to the site**, so the bucket has
to allow requests from the site's origin. Without it uploads fail in the browser
with a CORS error and nothing useful anywhere else — **while `npm run verify:s3`
still passes**, because that runs from Node, which has no CORS.

If uploads work from the verify script and fail in the browser, this is why.

R2 → `aela-estate-files` → **Settings** → **CORS policy** → Add:

```json
[
  {
    "AllowedOrigins": [
      "https://your-domain.example",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Replace `your-domain.example` with the real site. Keep `localhost` only while
developing — better still, use a second bucket for development so the
production one never lists it.

`content-type` must be allowed: the upload ticket signs the file's type, so the
browser is required to send it.

---

## 5. Leave the bucket private

Do **not** enable public access or a custom public domain for this bucket.

Reads go through `/api/files/[id]`, which checks that the person asking owns the
file and only then redirects to a URL signed for sixty seconds. A public bucket
would make every grower's photographs readable by anyone who learns an object
key — and object keys are random, but "hard to guess" is not the same as
"checked", and it would silently undo the isolation the rest of the portal is
built on.

---

## 6. Afterwards

- Uploads go straight to R2. Photos up to 50 MB, video up to 500 MB, PDFs up to
  25 MB — the full limits, which the app will not offer until a bucket is
  configured. See [storage.md](storage.md).
- `private-uploads/` stops filling up. **Existing files are not migrated.** The
  read path checks each attachment's own key, so old local files and new R2
  files coexist, but anything already uploaded stays on disk. If the demo
  content matters on the deployed site, re-upload it.
- Worth adding a **lifecycle rule** deleting anything under `verify/` after a
  day, and expiring incomplete uploads. A grower who closes the tab halfway
  leaves bytes with no database row pointing at them, and nothing else cleans
  those up.

## What it will cost

Egress is free — that is the whole reason for choosing R2 here. Storage runs
around ₹1.3 per GB per month and the request charges are negligible at this
volume, with the first 10 GB each month free. A few thousand photographs and a
couple of hundred videos should stay under a couple of hundred rupees a month
for a long while.

Those figures are from Cloudflare's published pricing and could have moved;
check the current page before quoting them to anyone.
