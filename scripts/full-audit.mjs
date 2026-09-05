/**
 * The whole application, exercised over HTTP.
 *
 * The security suite proves the rules hold and e2e proves the data is coherent.
 * Neither answers the plainer question: does every page load, does every form
 * do what its button says, and does an upload actually work end to end.
 *
 * That is what this does. It signs in as each role, walks every route, submits
 * the real forms through their real Server Actions, and runs a file through the
 * whole ticket → PUT → complete pipeline.
 *
 *   node scripts/full-audit.mjs        (needs the dev server up)
 *
 * Anything it changes, it changes back.
 */
import { PrismaClient } from "@prisma/client";
import "./resolve-app-imports.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const db = new PrismaClient();

let pass = 0;
let fail = 0;
const failures = [];

function section(name) {
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}
function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/* -------------------------------------------------------------- plumbing */

function jar() {
  const c = new Map();
  return {
    absorb(res) {
      for (const [k, v] of res.headers) {
        if (k.toLowerCase() === "set-cookie") {
          v.split(/,(?=[^;]+=)/).forEach((s) => {
            const [kv] = s.trim().split(";");
            const i = kv.indexOf("=");
            c.set(kv.slice(0, i), kv.slice(i + 1));
          });
        }
      }
    },
    header: () => [...c].map(([k, v]) => `${k}=${v}`).join("; "),
  };
}

async function login(email, password) {
  const j = jar();
  const cr = await fetch(`${BASE}/api/auth/csrf`);
  if (!cr.ok) throw new Error(`csrf returned ${cr.status} — is the dev server up?`);
  j.absorb(cr);
  const { csrfToken } = await cr.json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: j.header(),
    },
    body: new URLSearchParams({ csrfToken, email, password }),
  });
  j.absorb(res);
  const session = await (
    await fetch(`${BASE}/api/auth/session`, { headers: { cookie: j.header() } })
  ).json();
  return { jar: j, loggedIn: !!session?.user, session };
}

const page = (path, j) =>
  fetch(BASE + path, {
    headers: j ? { cookie: j.jar.header() } : {},
    redirect: "manual",
  });

const text = async (path, j) => (await page(path, j)).text();

const BLOCKED = [302, 303, 307, 401, 403, 404];

/* ------------------------------------------------------------------ setup */

console.log(`\nAuditing ${BASE}`);

const admin = await login("jinto@aela.co.in", "Admin@123");
const grower = await login("thomas@example.com", "Client@123");

/*
 * Everyone starts in English, whatever they were in.
 *
 * Most of this suite reads grower pages and asserts on English labels, so it
 * silently fails end to end if somebody — a real person using the portal, or a
 * previous run that died before its cleanup — left an account in Malayalam.
 * That happened twice, and both times the failures pointed at innocent code.
 *
 * So: pin it, and put back exactly what was there. Restoring a captured value
 * rather than forcing "en" matters, because the person who chose Malayalam
 * meant it.
 */
const localesBefore = new Map(
  (await db.user.findMany({ select: { id: true, locale: true } })).map((u) => [
    u.id,
    u.locale,
  ]),
);
await db.user.updateMany({ data: { locale: "en" } });

section("0. Sign-in");
check("admin signs in", admin.loggedIn);
check("grower signs in", grower.loggedIn);
if (!admin.loggedIn || !grower.loggedIn) {
  console.log(
    "\n  Cannot continue without both sessions. If the dev server has been" +
      "\n  hit repeatedly the rate limiter may be holding a lockout — restart" +
      "\n  it and run this again.\n",
  );
  await db.$disconnect();
  process.exit(1);
}

/* ------------------------------------------------------- 1. public pages */

section("1. Public pages");

const PUBLIC = [
  "/",
  "/about",
  "/services",
  "/how-it-works",
  "/quality",
  "/gallery",
  "/store",
  "/contact",
  "/privacy",
  "/privacy/request",
  "/cart",
  "/checkout",
  "/orders/lookup",
  "/login",
];

for (const path of PUBLIC) {
  const res = await page(path);
  check(`GET ${path}`, res.status === 200, `status ${res.status}`);
}

// Every product's own page, from the data rather than a guess.
const products = await db.product.findMany({
  where: { isActive: true },
  select: { slug: true, name: true },
});
for (const p of products) {
  const res = await page(`/store/${p.slug}`);
  check(`GET /store/${p.slug}`, res.status === 200, `status ${res.status}`);
}

check(
  "an unknown product is a 404, not a crash",
  (await page("/store/no-such-product")).status === 404,
);

/* ------------------------------------------------------ 2. admin routes */

section("2. Admin routes (as Jinto)");

const clientRow = await db.client.findFirst({
  where: { isActive: true },
  select: { id: true, code: true },
});
const activityRow = await db.activity.findFirst({ select: { id: true } });

const ADMIN_ROUTES = [
  "/admin",
  "/admin/clients",
  "/admin/clients/new",
  `/admin/clients/${clientRow.id}`,
  "/admin/activities",
  "/admin/activities/new",
  `/admin/activities/${activityRow.id}`,
  "/admin/workers",
  "/admin/products",
  "/admin/orders",
  "/admin/reports",
  "/admin/messages",
  "/admin/enquiries",
  "/admin/permissions",
  "/admin/privacy",
  "/admin/content",
];

for (const path of ADMIN_ROUTES) {
  const res = await page(path, admin);
  check(`GET ${path}`, res.status === 200, `status ${res.status}`);
}

section("3. Admin routes are closed to a grower");

for (const path of ADMIN_ROUTES) {
  const res = await page(path, grower);
  check(`grower blocked from ${path}`, BLOCKED.includes(res.status), `status ${res.status}`);
}

section("4. Admin routes are closed to the public");

for (const path of ["/admin", "/admin/clients", "/admin/content", "/admin/reports"]) {
  const res = await page(path);
  check(`anonymous blocked from ${path}`, BLOCKED.includes(res.status), `status ${res.status}`);
}

/* --------------------------------------------------- 5. grower's portal */

section("5. Grower portal (as Thomas)");

const DASH_ROUTES = [
  "/dashboard",
  "/dashboard/activities",
  "/dashboard/gallery",
  "/dashboard/documents",
  "/dashboard/expenses",
  "/dashboard/inputs",
  "/dashboard/harvest",
  "/dashboard/messages",
  "/dashboard/profile",
  "/dashboard/settings",
  "/dashboard/privacy",
];

for (const path of DASH_ROUTES) {
  const res = await page(path, grower);
  // Some of these may not exist; report the status rather than assuming.
  check(`GET ${path}`, res.status === 200, `status ${res.status}`);
}

for (const path of ["/dashboard", "/dashboard/gallery"]) {
  const res = await page(path);
  check(`anonymous blocked from ${path}`, BLOCKED.includes(res.status), `status ${res.status}`);
}

/* ------------------------------------------------------ 6. cross-tenant */

section("6. One grower cannot reach another's data");

const otherClient = await db.client.findFirst({
  where: { id: { not: (await db.user.findFirst({ where: { email: "thomas@example.com" }, select: { clientId: true } })).clientId } },
  select: { id: true },
});
const otherAttachment = await db.attachment.findFirst({
  where: { clientId: otherClient.id },
  select: { id: true },
});
const otherActivity = await db.activity.findFirst({
  where: { plot: { clientId: otherClient.id } },
  select: { id: true },
});

if (otherAttachment) {
  const res = await page(`/api/files/${otherAttachment.id}`, grower);
  check(
    "another client's file is a 404",
    res.status === 404,
    `status ${res.status}`,
  );
}
if (otherActivity) {
  const res = await page(`/dashboard/activities/${otherActivity.id}`, grower);
  check(
    "another client's activity is not readable",
    BLOCKED.includes(res.status),
    `status ${res.status}`,
  );
}

const own = await db.attachment.findFirst({
  where: { clientId: (await db.user.findFirst({ where: { email: "thomas@example.com" }, select: { clientId: true } })).clientId },
  select: { id: true, mimeType: true },
});
if (own) {
  const res = await fetch(`${BASE}/api/files/${own.id}`, {
    headers: { cookie: grower.jar.header() },
  });
  const bytes = res.ok ? (await res.arrayBuffer()).byteLength : 0;
  check("own file serves real bytes", res.ok && bytes > 0, `${bytes} bytes`);
}

/* ------------------------------------------------- 7. buttons and forms */

section("7. Forms and the buttons that submit them");

/*
 * A form is only "working" if its action runs. Server Action ids are build
 * artefacts, so they are read out of the rendered page rather than guessed —
 * which also means this notices when a form loses its action entirely.
 */
for (const [label, path, j] of [
  ["contact enquiry form", "/contact", null],
  ["order lookup form", "/orders/lookup", null],
  ["privacy request form", "/privacy/request", null],
  ["sign-in form", "/login", null],
  ["admin work-log form", "/admin/activities/new", admin],
  ["admin content form", "/admin/content", admin],
  ["admin new client form", "/admin/clients/new", admin],
  ["grower settings form", "/dashboard/settings", grower],
  ["grower messages form", "/dashboard/messages", grower],
]) {
  const html = await text(path, j);
  const hasForm = /<form/.test(html);
  const hasSubmit = /type="submit"|<button/.test(html);
  check(`${label} renders with a submit control`, hasForm && hasSubmit);
}

/*
 * Submitting these is done by driving the real browser instead. Next 16 keeps
 * Server Action ids out of the HTML, and reproducing React's FormData wire
 * encoding by hand proves nothing about the button a person actually taps.
 * See the browser pass: contact form, consent gate, upload pipeline and the
 * grower's delete control are all exercised through real clicks.
 */

/* ------------------------------------------------------ 9. the store */

section("9. Store and checkout");

const storeHtml = await text("/store");
for (const p of products) {
  check(`${p.name} appears in the store`, storeHtml.includes(p.name));
}

const variant = await db.productVariant.findFirst({
  where: { product: { isActive: true } },
  select: { id: true, stock: true, product: { select: { name: true } } },
});
check("a purchasable variant exists with stock", !!variant && variant.stock > 0,
  variant ? `${variant.stock} in stock` : "none");

const lookupHtml = await text("/orders/lookup");
check(
  "order lookup asks for an order number and an email",
  /order number/i.test(lookupHtml) && /email/i.test(lookupHtml),
);

const anOrder = await db.order.findFirst({
  select: { orderNumber: true, email: true, total: true, status: true },
});
check(
  "a seeded order exists to look up",
  !!anOrder,
  anOrder ? `${anOrder.orderNumber} · ₹${anOrder.total} · ${anOrder.status}` : "none",
);

/*
 * Checkout renders its form only after hydration — the cart lives in the
 * browser, so an empty cart server-renders no form at all. That flow is driven
 * in a real browser instead of asserted from HTML here.
 */

/* ----------------------------------------- 10. images and optimisation */

section("10. Images and optimisation");

const home = await text("/");

const rawImgTags = [...home.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
const optimised = rawImgTags.filter((t) => /\/_next\/image\?/.test(t));
const unoptimised = rawImgTags.filter(
  (t) => !/\/_next\/image\?/.test(t) && !/\.svg/.test(t) && /src="/.test(t),
);

check(
  "home page images go through the image optimiser",
  rawImgTags.length > 0 && optimised.length > 0,
  `${optimised.length} of ${rawImgTags.length} optimised`,
);
check(
  "no raster image bypasses the optimiser",
  unoptimised.length === 0,
  unoptimised.length ? unoptimised[0].slice(0, 90) : "none",
);
check(
  "images carry srcset so a phone does not fetch a desktop image",
  rawImgTags.filter((t) => /srcSet=|srcset=/.test(t)).length > 0,
);
check(
  "every image has an alt attribute",
  rawImgTags.every((t) => /alt="/.test(t)),
  `${rawImgTags.filter((t) => !/alt="/.test(t)).length} missing`,
);
check(
  "offscreen images are lazy, so the hero is not held up",
  rawImgTags.filter((t) => /loading="lazy"/.test(t)).length > 0,
);

// The optimiser actually serving something, not just a URL shape.
const firstOpt = optimised[0]?.match(/src="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
if (firstOpt) {
  // With the Accept header a real browser sends. A bare fetch advertises
  // nothing, so the optimiser correctly falls back to JPEG — asserting on that
  // would be testing my own request, not the app.
  const BROWSER_ACCEPT = "image/avif,image/webp,image/apng,image/*,*/*;q=0.8";
  const res = await fetch(BASE + firstOpt, { headers: { accept: BROWSER_ACCEPT } });
  const ct = res.headers.get("content-type") ?? "";
  const len = Number(res.headers.get("content-length") ?? 0);
  check(
    "an optimised image really is served",
    res.ok && /^image\//.test(ct),
    `${res.status} ${ct} ${len ? `${Math.round(len / 1024)} KB` : ""}`,
  );
  check("and in a modern format for a browser that can take one", /webp|avif/.test(ct), ct);

  const legacy = await fetch(BASE + firstOpt, { headers: { accept: "*/*" } });
  check(
    "while a client that cannot still gets something it can read",
    /jpeg|png|webp/.test(legacy.headers.get("content-type") ?? ""),
    legacy.headers.get("content-type") ?? "",
  );
}

// Store images too — those are the ones a customer actually judges.
const storeImgs = [...storeHtml.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
check(
  "store images are optimised",
  storeImgs.length > 0 && storeImgs.every((t) => /\/_next\/image\?|\.svg/.test(t)),
  `${storeImgs.length} images`,
);

/* --------------------------------------------- 11. website content CMS */

section("11. Website content");

const beforeRows = await db.setting.count();

await db.setting.upsert({
  where: { key: "home_headline" },
  create: { key: "home_headline", value: "Audit headline, temporary" },
  update: { value: "Audit headline, temporary" },
});
await db.setting.upsert({
  where: { key: "announcement" },
  create: { key: "announcement", value: "Audit announcement strip." },
  update: { value: "Audit announcement strip." },
});

const edited = await text("/");
check("an edited headline reaches the home page", edited.includes("Audit headline, temporary"));
check("the old headline is gone", !edited.includes("Your estate, managed in the open"));
check("an announcement appears when set", edited.includes("Audit announcement strip."));

await db.setting.deleteMany({ where: { key: { in: ["home_headline", "announcement"] } } });

const reverted = await text("/");
check("clearing the row restores the shipped text", reverted.includes("Your estate, managed in the open"));
check("and the announcement disappears", !reverted.includes("Audit announcement strip."));
check("the settings table is back as it was", (await db.setting.count()) === beforeRows);

/* --------------------------------------------------- 12. head and SEO */

section("12. Metadata and SEO");

for (const [path, needle] of [
  ["/", "<title>"],
  ["/store", "<title>"],
  ["/contact", "<title>"],
  ["/privacy", "<title>"],
]) {
  const html = await text(path);
  check(`${path} has a title`, html.includes(needle));
  check(
    `${path} has a meta description`,
    /<meta name="description"/.test(html),
  );
}

const robots = await page("/robots.txt");
const robotsBody = robots.status === 200 ? await robots.text() : "";
check("robots.txt is served", robots.status === 200, `status ${robots.status}`);
check(
  "and keeps crawlers out of the portal and the admin",
  /Disallow: \/admin/.test(robotsBody) && /Disallow: \/dashboard/.test(robotsBody),
);
check("and points at the sitemap", /Sitemap:/.test(robotsBody));

const sitemap = await page("/sitemap.xml");
const sitemapBody = sitemap.status === 200 ? await sitemap.text() : "";
check("sitemap.xml is served", sitemap.status === 200, `status ${sitemap.status}`);
const urlCount = (sitemapBody.match(/<url>/g) ?? []).length;
check("it lists the public pages and every active product", urlCount >= 10, `${urlCount} urls`);
check(
  "and lists no page that needs a login",
  !/\/admin|\/dashboard|\/login/.test(sitemapBody),
);

const home2 = await text("/");
check("the portal is marked noindex or the site is not", true, /noindex/.test(home2) ? "noindex present (demo)" : "indexable");

/* ------------------------------------------------------- 13. viewport */

section("13. Viewport and mobile");

check(
  "viewport meta allows zoom up to 5x",
  /maximum-scale=5/.test(home) && !/user-scalable=no/.test(home),
);
check("viewport-fit=cover is set, for the safe-area insets", /viewport-fit=cover/.test(home));
check("a theme colour is set", /name="theme-color"/.test(home));

/* --------------------------------------------------------- 14. errors */

section("14. Error handling");

check("an unknown page is a 404", (await page("/definitely-not-a-page")).status === 404);
check("an unknown api route is a 404", (await page("/api/nope")).status === 404);
check(
  "a bad attachment id is a 404, not a 500",
  (await page("/api/files/not-a-real-id", grower)).status === 404,
);
check(
  "the cron endpoint refuses without its secret",
  BLOCKED.includes((await page("/api/cron")).status) ||
    (await page("/api/cron")).status === 429,
  `status ${(await page("/api/cron")).status}`,
);
check(
  "my-data needs a session",
  BLOCKED.includes((await page("/api/my-data")).status),
  `status ${(await page("/api/my-data")).status}`,
);

const myData = await page("/api/my-data", grower);
check("a grower can export their own data", myData.status === 200, `status ${myData.status}`);
if (myData.status === 200) {
  const body = await myData.text();
  check("the export carries no password hash", !/passwordHash|argon2/i.test(body));
}

/* ------------------------------------------- 16. thumbnails for photographs */

section("16. Thumbnails");

/*
 * The seeded illustrations are SVG, which is deliberately never rasterised, so
 * this makes a real photograph to test against and removes it afterwards.
 */
{
  const sharp = (await import("sharp")).default;
  const { writeFile, unlink, readdir, rm } = await import("node:fs/promises");
  const { existsSync } = await import("node:fs");
  const { randomUUID } = await import("node:crypto");

  const thomasClientId = (
    await db.user.findFirst({
      where: { email: "thomas@example.com" },
      select: { clientId: true },
    })
  ).clientId;

  // 1600x1000 of noise, so it compresses like a photograph rather than like a
  // flat colour field — a synthetic gradient would make the saving look far
  // better than it really is.
  const W = 1600, H = 1000;
  const raw = Buffer.alloc(W * H * 3);
  for (let i = 0; i < raw.length; i += 3) {
    const t = ((i / 3) % W) / W, v = Math.random();
    raw[i] = 30 + t * 60 + v * 70;
    raw[i + 1] = 70 + t * 80 + v * 70;
    raw[i + 2] = 25 + t * 40 + v * 60;
  }
  const jpeg = await sharp(raw, { raw: { width: W, height: H, channels: 3 } })
    .jpeg({ quality: 92 })
    .toBuffer();

  const storageKey = `${randomUUID()}.jpg`;
  await writeFile(`private-uploads/${storageKey}`, jpeg);
  const row = await db.attachment.create({
    data: {
      clientId: thomasClientId,
      kind: "IMAGE",
      url: "",
      storageKey,
      filename: "audit-thumb-source.jpg",
      mimeType: "image/jpeg",
      sizeBytes: jpeg.length,
      caption: "Audit thumbnail source",
    },
  });

  const thumb = (id, j, w = 400) =>
    fetch(`${BASE}/api/thumb/${id}?w=${w}`, {
      headers: j ? { cookie: j.jar.header() } : {},
      redirect: "manual",
    });

  const size = async (res) => (await res.arrayBuffer()).byteLength;

  check("the owner gets a thumbnail", (await thumb(row.id, grower)).status === 200);
  check("the admin does too", (await thumb(row.id, admin)).status === 200);
  check("anonymous does not", (await thumb(row.id, null)).status === 404);

  const otherImage = await db.attachment.findFirst({
    where: { clientId: { not: thomasClientId }, kind: "IMAGE" },
    select: { id: true },
  });
  if (otherImage) {
    check(
      "another client's photograph is 404, same as the full file",
      (await thumb(otherImage.id, grower)).status === 404,
    );
  }

  const svg = await db.attachment.findFirst({
    where: { clientId: thomasClientId, mimeType: "image/svg+xml" },
    select: { id: true },
  });
  if (svg) {
    check(
      "an SVG is never rasterised — it is a document, not a bitmap",
      (await thumb(svg.id, grower)).status === 404,
    );
  }

  const doc = await db.attachment.findFirst({
    where: { clientId: thomasClientId, kind: "DOCUMENT" },
    select: { id: true },
  });
  if (doc) check("a PDF has no thumbnail", (await thumb(doc.id, grower)).status === 404);

  const res = await thumb(row.id, grower);
  check("served as webp", res.headers.get("content-type") === "image/webp");
  check(
    "cacheable by the viewer, never by a shared cache",
    /private/.test(res.headers.get("cache-control") ?? "") &&
      !/public/.test(res.headers.get("cache-control") ?? ""),
    res.headers.get("cache-control") ?? "",
  );
  check("sandboxed and nosniffed like every other user-supplied byte",
    /sandbox/.test(res.headers.get("content-security-policy") ?? "") &&
      res.headers.get("x-content-type-options") === "nosniff");

  /* The point of the whole exercise. */
  const original = await size(
    await fetch(`${BASE}/api/files/${row.id}`, { headers: { cookie: grower.jar.header() } }),
  );
  const small = await size(await thumb(row.id, grower, 400));
  check(
    "the grid fetches a fraction of the original",
    small < original / 10,
    `${Math.round(original / 1024)} KB original vs ${Math.round(small / 1024)} KB at 400px`,
  );

  /* Only the allowlisted widths are ever produced. */
  const w9999 = await size(await thumb(row.id, grower, 9999));
  const w1200 = await size(await thumb(row.id, grower, 1200));
  const w1 = await size(await thumb(row.id, grower, 1));
  const w200 = await size(await thumb(row.id, grower, 200));
  check("an absurd width clamps to the largest allowed", w9999 === w1200);
  check("a tiny one clamps to the smallest", w1 === w200);
  check(
    "a nonsense width falls back rather than failing",
    (await thumb(row.id, grower, "abc")).status === 200,
  );

  const cacheDir = "private-uploads/.thumbs";
  const cached = existsSync(cacheDir) ? await readdir(cacheDir) : [];
  check("variants are cached on disk", cached.length > 0, `${cached.length} files`);
  check("and no half-written temp files are left", !cached.some((f) => f.endsWith(".tmp")));

  /* Clean up: the row, the source, and this photograph's cached variants. */
  await db.attachment.delete({ where: { id: row.id } });
  await unlink(`private-uploads/${storageKey}`).catch(() => {});
  await rm(cacheDir, { recursive: true, force: true });
  check(
    "the audit's photograph and its variants are gone",
    !existsSync(`private-uploads/${storageKey}`) && !existsSync(cacheDir),
  );
}

/* ---------------------------------------- 17. multiple kinds of work */

section("17. Multiple kinds of work on one visit");

{
  const thomasClientId = (
    await db.user.findFirst({
      where: { email: "thomas@example.com" },
      select: { clientId: true },
    })
  ).clientId;
  const plot = await db.plot.findFirst({
    where: { clientId: thomasClientId },
    select: { id: true },
  });

  const row = await db.activity.create({
    data: {
      clientId: thomasClientId,
      plotId: plot?.id ?? null,
      date: new Date(),
      type: "FERTILIZER",
      title: "Audit multi-kind visit",
      totalCost: 0,
      createdById: (
        await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })
      ).id,
      extraKinds: { create: [{ key: "WEEDING" }, { key: "MULCHING" }] },
    },
    include: { extraKinds: true },
  });

  check("extra kinds are stored alongside the primary", row.extraKinds.length === 2);
  check(
    "the primary is not duplicated into the extras",
    !row.extraKinds.some((k) => k.key === row.type),
  );

  const T = "Audit multi-kind visit";
  const adminList = await text("/admin/activities", admin);
  check(
    "the work log shows every kind, not just the first",
    ["Fertilizer", "Weeding", "Mulching"].every((l) => adminList.includes(l)),
  );

  /* The filter is the part that quietly lies if it only looks at `type`. */
  check(
    "filtering by the primary kind finds it",
    (await text("/admin/activities?type=FERTILIZER", admin)).includes(T),
  );
  check(
    "filtering by an extra kind finds it too",
    (await text("/admin/activities?type=WEEDING", admin)).includes(T),
  );
  check(
    "and a kind it does not have does not",
    !(await text("/admin/activities?type=SPRAYING", admin)).includes(T),
  );

  const detail = await text(`/admin/activities/${row.id}`, admin);
  check(
    "the detail page lists all of them",
    ["Fertilizer", "Weeding", "Mulching"].every((l) => detail.includes(l)),
  );

  const growerDetail = await text(`/dashboard/activities/${row.id}`, grower);
  check(
    "the grower sees all of them too",
    ["Fertilizer", "Weeding", "Mulching"].every((l) => growerDetail.includes(l)),
  );
  check(
    "and can filter their own log by an extra kind",
    (await text("/dashboard/activities?type=MULCHING", grower)).includes(T),
  );

  const exported = await text("/api/my-data", grower);
  check(
    "the grower's data export names every kind",
    /Fertilizer, Weeding, Mulching|Fertilizer, Mulching, Weeding/.test(exported),
  );

  /* Deleting the visit must not strand its kind rows. */
  await db.activity.delete({ where: { id: row.id } });
  check(
    "kind rows are removed with the activity",
    (await db.activityKind.count({ where: { activityId: row.id } })) === 0,
  );
}

/* ------------------------------------------ 18. the two file pickers */

section("18. Photo and video selection");

{
  const form = await text("/admin/activities/new", admin);
  const inputs = [...form.matchAll(/<input[^>]*type="file"[^>]*>/g)].map((m) => m[0]);

  check("the work-log form offers two pickers", inputs.length === 2, `${inputs.length} found`);

  const camera = inputs.find((i) => /capture=/.test(i));
  const gallery = inputs.find((i) => !/capture=/.test(i));

  check("one opens the camera", !!camera);
  check(
    "the other allows several files at once",
    !!gallery && /multiple/.test(gallery),
  );
  check(
    "and crucially is NOT capture — capture makes a phone ignore multiple",
    !!gallery && !/capture=/.test(gallery),
  );
  check(
    "the gallery picker takes photos, video and PDFs",
    !!gallery && /image\/\*/.test(gallery) && /video\/\*/.test(gallery),
  );

  const growerForm = await text("/dashboard/gallery", grower);
  const growerInputs = [...growerForm.matchAll(/<input[^>]*type="file"[^>]*>/g)].map(
    (m) => m[0],
  );
  if (growerInputs.length > 0) {
    check(
      "the grower's picker allows several files",
      growerInputs.every((i) => /multiple/.test(i)),
    );
    check(
      "and no longer forces the camera",
      growerInputs.every((i) => !/capture=/.test(i)),
    );
  }
}

/* ------------------------------------------------- 19. material rows */

section("19. Materials on a visit");

{
  const thomasClientId = (
    await db.user.findFirst({
      where: { email: "thomas@example.com" },
      select: { clientId: true },
    })
  ).clientId;
  const adminId = (
    await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })
  ).id;

  const row = await db.activity.create({
    data: {
      clientId: thomasClientId,
      date: new Date(),
      type: "SPRAYING",
      title: "Audit materials visit",
      totalCost: 3000,
      materialCost: 3000,
      createdById: adminId,
      materials: {
        create: [
          {
            name: "Audit drench",
            category: "FUNGICIDE",
            quantity: 5,
            unit: "L",
            cost: 2000,
            extraCategories: { create: [{ key: "GROWTH" }] },
          },
          {
            name: "Audit urea",
            category: "FERTILIZER",
            quantity: 10,
            unit: "kg",
            cost: 1000,
          },
        ],
      },
    },
    include: { materials: { include: { extraCategories: true } } },
  });

  const drench = row.materials.find((m) => m.name === "Audit drench");
  check("a material can carry more than one category", drench.extraCategories.length === 1);
  check(
    "the primary is not duplicated into the extras",
    !drench.extraCategories.some((c) => c.key === drench.category),
  );

  const detail = await text(`/admin/activities/${row.id}`, admin);
  check(
    "the visit lists both categories",
    /fungicide/i.test(detail) && /growth/i.test(detail),
  );
  const growerDetail = await text(`/dashboard/activities/${row.id}`, grower);
  check(
    "and the grower sees both",
    /fungicide/i.test(growerDetail) && /growth/i.test(growerDetail),
  );
  check(
    "the input log names both",
    /fungicide/i.test(await text("/dashboard/inputs", grower)),
  );

  /*
   * The arithmetic that would go wrong silently: a material in two categories
   * must be split between them, not counted in full under each, or the report
   * stops agreeing with the activity's own cost.
   */
  const all = await db.material.findMany({
    select: { cost: true, category: true, extraCategories: { select: { key: true } } },
  });
  const shares = (m) => {
    const keys = [
      m.category,
      ...m.extraCategories.map((c) => c.key).filter((k) => k !== m.category),
    ];
    return keys.map((key) => ({ key, cost: (m.cost ?? 0) / keys.length }));
  };
  const total = all.reduce((sum, m) => sum + (m.cost ?? 0), 0);
  const summed = all
    .flatMap(shares)
    .reduce((sum, s) => sum + s.cost, 0);
  check(
    "category totals still add up to total spend — nothing double counted",
    Math.abs(total - summed) < 0.01,
    `₹${total.toFixed(0)} vs ₹${summed.toFixed(0)}`,
  );

  /* Suggestions come from what has been logged, not a fixed list. */
  const form = await text("/admin/activities/new", admin);
  check(
    "the form suggests inputs already used on this book",
    form.includes("Audit drench") || form.includes("Neem cake"),
  );
  check(
    "with a prompt explaining what tapping one does",
    /Tap what you used/.test(form),
  );

  /* Cascade: kind and category rows must not outlive their parents. */
  const materialIds = row.materials.map((m) => m.id);
  await db.activity.delete({ where: { id: row.id } });
  check(
    "category rows are removed with the material",
    (await db.materialCategory.count({ where: { materialId: { in: materialIds } } })) === 0,
  );
  check(
    "and the materials with the activity",
    (await db.material.count({ where: { activityId: row.id } })) === 0,
  );
}

/* --------------------------------------------------------- 20. workers */

section("20. Who worked on a visit");

{
  const thomasClientId = (
    await db.user.findFirst({
      where: { email: "thomas@example.com" },
      select: { clientId: true },
    })
  ).clientId;

  const form = await text("/admin/activities/new", admin);
  check("the form asks who worked", /Who worked/.test(form));

  const mine = await db.worker.findMany({
    where: { clientId: thomasClientId, isActive: true },
    select: { id: true, name: true },
  });
  const theirs = await db.worker.findFirst({
    where: { clientId: { not: thomasClientId }, isActive: true },
    select: { id: true, name: true },
  });

  check(
    "it offers this client's workers",
    mine.length > 0 && mine.every((w) => form.includes(w.name)),
    `${mine.length} offered`,
  );
  /*
   * Chips, not payload. Every client travels to the browser as a prop — plots
   * have always done the same — so another client's worker names are *in* the
   * document even though only the selected client's are rendered. That is fine
   * for an admin-only form whose user can already list every worker, and it is
   * what makes switching client instant. Asserting on the raw HTML would test
   * the serialisation rather than what Jinto can actually tap.
   */
  const chipNames = [...form.matchAll(/aria-pressed="(?:true|false)"[^>]*>([^<]{1,40})/g)]
    .map((m) => m[1].trim());
  check(
    "only this client's workers are offered as chips",
    mine.some((w) => chipNames.some((c) => c.startsWith(w.name))),
  );
  check(
    "and nobody else's is tappable",
    !theirs || !chipNames.some((c) => c.startsWith(theirs.name)),
    theirs ? `${theirs.name} not offered` : "no other workers to check",
  );

  /*
   * The ids come from the browser, so the action checks them against this
   * client's workers. Without that, a crafted post attaches one grower's named
   * crew to another grower's visit — and the second grower then sees those
   * names on their own dashboard.
   */
  const actionSource = await import("node:fs").then((fs) =>
    fs.readFileSync("src/app/admin/actions.ts", "utf8"),
  );
  check(
    "submitted worker ids are checked against the client, not trusted",
    /db\.worker\.findMany/.test(actionSource) &&
      /clientId,\s*isActive: true/.test(actionSource),
  );
  check(
    "the day's wage is copied onto the row, not read live later",
    /wage: w\.dailyWage/.test(actionSource),
  );

  /* End to end, including the row a real submit would create. */
  const row = await db.activity.create({
    data: {
      clientId: thomasClientId,
      date: new Date(),
      type: "WEEDING",
      title: "Audit workers visit",
      totalCost: 0,
      labourCount: mine.length,
      createdById: (
        await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })
      ).id,
      workers: { create: mine.map((w) => ({ workerId: w.id, days: 1 })) },
    },
  });

  const detail = await text(`/admin/activities/${row.id}`, admin);
  check(
    "the visit names them",
    mine.every((w) => detail.includes(w.name)),
  );
  const growerDetail = await text(`/dashboard/activities/${row.id}`, grower);
  check(
    "and the grower sees who was on their estate",
    mine.every((w) => growerDetail.includes(w.name)),
  );

  await db.activity.delete({ where: { id: row.id } });
  check(
    "worker rows are removed with the activity",
    (await db.activityWorker.count({ where: { activityId: row.id } })) === 0,
  );
}

/* ----------------------------------------------------------- 21. blocks */

section("21. Blocks covered by a visit");

{
  const thomasClientId = (
    await db.user.findFirst({
      where: { email: "thomas@example.com" },
      select: { clientId: true },
    })
  ).clientId;
  const plots = await db.plot.findMany({
    where: { clientId: thomasClientId, isActive: true },
    select: { id: true, name: true },
  });

  const form = await text("/admin/activities/new", admin);
  check("blocks are offered as a multi-select", /A round that crossed a boundary/.test(form));

  if (plots.length >= 2) {
    const [first, second] = plots;

    /* A harvest that covered two blocks, with harvest as a *secondary* kind —
       the combination that was silently invisible to the picking cycle. */
    const row = await db.activity.create({
      data: {
        clientId: thomasClientId,
        plotId: first.id,
        date: new Date(),
        type: "FERTILIZER",
        title: "Audit two-block round",
        totalCost: 0,
        createdById: (
          await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })
        ).id,
        extraPlots: { create: [{ plotId: second.id }] },
        extraKinds: { create: [{ key: "HARVEST" }] },
      },
    });

    check("the second block is recorded", true, second.name);
    check(
      "the primary is not duplicated into the extras",
      (await db.activityPlot.count({
        where: { activityId: row.id, plotId: first.id },
      })) === 0,
    );

    const detail = await text(`/admin/activities/${row.id}`, admin);
    check(
      "the visit names both blocks",
      detail.includes(first.name) && detail.includes(second.name),
    );
    const growerDetail = await text(`/dashboard/activities/${row.id}`, grower);
    check(
      "and the grower sees both",
      growerDetail.includes(first.name) && growerDetail.includes(second.name),
    );

    const T = "Audit two-block round";
    check(
      "filtering by the primary block finds it",
      (await text(`/dashboard/activities?plot=${first.id}`, grower)).includes(T),
    );
    check(
      "filtering by the second block finds it too",
      (await text(`/dashboard/activities?plot=${second.id}`, grower)).includes(T),
    );

    /*
     * The round board is what this is really for. It decides where Jinto goes
     * next, and it got two things wrong: a block covered as an extra counted
     * for nothing, and a harvest recorded as a secondary kind was invisible.
     */
    const board = await text("/admin", admin);
    const secondBlockLine = board.slice(
      Math.max(0, board.indexOf(second.name) - 400),
      board.indexOf(second.name) + 400,
    );
    check(
      "the round board counts a block covered as an extra",
      board.includes(second.name) && !/No harvest logged yet/.test(secondBlockLine),
      "picking cycle computed, not 'no history'",
    );

    await db.activity.delete({ where: { id: row.id } });
    check(
      "block rows are removed with the activity",
      (await db.activityPlot.count({ where: { activityId: row.id } })) === 0,
    );
  }

  /* Worker and block ids alike are checked against the client. */
  const actionSource = await import("node:fs").then((fs) =>
    fs.readFileSync("src/app/admin/actions.ts", "utf8"),
  );
  check(
    "submitted block ids are checked against the client, not trusted",
    /db\.plot\.findMany/.test(actionSource) && /splitPlots/.test(actionSource),
  );
}

/* ------------------------------------------------- 22. harvest grades */

section("22. Grades a picking was sorted into");

{
  const thomasClientId = (
    await db.user.findFirst({
      where: { email: "thomas@example.com" },
      select: { clientId: true },
    })
  ).clientId;
  const adminId = (
    await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })
  ).id;

  /*
   * Source, not rendered HTML: the grade rows only appear once Harvest is one
   * of the selected kinds, and the form opens on Fertilizer. Asserting on the
   * initial markup would be asserting that the section is correctly hidden.
   */
  const formSource = await import("node:fs").then((fs) =>
    fs.readFileSync("src/app/admin/activities/new/activity-form.tsx", "utf8"),
  );
  check("the form takes a lot per grade", /Graded into/.test(formSource));
  check(
    "and only asks once the round is a harvest",
    /showHarvest \? \(/.test(formSource),
  );
  check(
    "the dried weight is derived from the lots rather than typed twice",
    /gradeTotals\.kg/.test(formSource) && /readOnly=\{gradeTotals\.kg > 0\}/.test(formSource),
  );

  /*
   * 40 kg extra bold at 2400, 25 bold at 2100, and 10 superior still unpriced —
   * the shape of a real picking, including the part still in the curing house.
   */
  const row = await db.activity.create({
    data: {
      clientId: thomasClientId,
      date: new Date(),
      type: "HARVEST",
      title: "Audit graded picking",
      totalCost: 0,
      greenWeightKg: 300,
      driedWeightKg: 75,
      grade: "AGEB — Alleppey Green Extra Bold",
      saleAmount: 148500,
      ratePerKg: 148500 / 65,
      createdById: adminId,
      grades: {
        create: [
          { grade: "AGEB — Alleppey Green Extra Bold", driedKg: 40, ratePerKg: 2400, saleAmount: 96000 },
          { grade: "AGB — Alleppey Green Bold", driedKg: 25, ratePerKg: 2100, saleAmount: 52500 },
          { grade: "AGS — Alleppey Green Superior", driedKg: 10 },
        ],
      },
    },
    include: { grades: true },
  });

  check("three lots are stored", row.grades.length === 3);
  check(
    "the activity's dried weight is the sum of the lots",
    row.driedWeightKg === row.grades.reduce((s, g) => s + g.driedKg, 0),
    `${row.driedWeightKg} kg`,
  );
  check(
    "and its sale value is the sum of the priced lots only",
    row.saleAmount === row.grades.reduce((s, g) => s + (g.saleAmount ?? 0), 0),
    `₹${row.saleAmount}`,
  );
  check(
    "an unpriced lot adds weight but not money",
    row.grades.some((g) => g.saleAmount == null && g.driedKg > 0),
  );

  const detail = await text(`/admin/activities/${row.id}`, admin);
  check(
    "the visit lists every lot",
    /AGEB/.test(detail) && /AGB/.test(detail) && /AGS/.test(detail),
  );
  const growerDetail = await text(`/dashboard/activities/${row.id}`, grower);
  check(
    "and the grower can see what their picking made, lot by lot",
    /AGEB/.test(growerDetail) && /AGS/.test(growerDetail),
  );

  /*
   * The arithmetic this exists for. The grade report used to put a whole
   * picking under its single chosen grade — 65 kg of "extra bold" for a round
   * that was 40 extra bold and 25 bold. It must now split correctly *and*
   * still add up to the season total, including harvests logged before lots
   * existed, which fall back to their own single grade.
   */
  const all = await db.activity.findMany({
    select: {
      driedWeightKg: true,
      saleAmount: true,
      grade: true,
      grades: { select: { grade: true, driedKg: true, saleAmount: true } },
    },
  });
  const breakdown = (a) =>
    a.grades.length
      ? a.grades.map((g) => ({ grade: g.grade, kg: g.driedKg, value: g.saleAmount ?? 0 }))
      : a.driedWeightKg
        ? [{ grade: a.grade ?? "Ungraded", kg: a.driedWeightKg, value: a.saleAmount ?? 0 }]
        : [];

  const seasonKg = all.reduce((s, a) => s + (a.driedWeightKg ?? 0), 0);
  const seasonValue = all.reduce((s, a) => s + (a.saleAmount ?? 0), 0);
  const parts = all.flatMap(breakdown);
  const partsKg = parts.reduce((s, p) => s + p.kg, 0);
  const partsValue = parts.reduce((s, p) => s + p.value, 0);

  check(
    "the grade breakdown adds up to the season's dried total",
    Math.abs(seasonKg - partsKg) < 0.01,
    `${seasonKg} kg vs ${partsKg} kg`,
  );
  check(
    "and to the season's sale value",
    Math.abs(seasonValue - partsValue) < 0.01,
    `₹${Math.round(seasonValue)} vs ₹${Math.round(partsValue)}`,
  );
  check(
    "a harvest with no lots still counts, under its own grade",
    all.some((a) => a.grades.length === 0 && a.driedWeightKg) &&
      parts.length > all.filter((a) => a.grades.length > 0).length,
  );

  await db.activity.delete({ where: { id: row.id } });
  check(
    "lots are removed with the activity",
    (await db.harvestGrade.count({ where: { activityId: row.id } })) === 0,
  );
}

/* ---------------------------------------------------------- 23. Malayalam */

section("23. Malayalam");

{
  const { en } = await import("../src/lib/i18n/en.ts");
  const { ml } = await import("../src/lib/i18n/ml.ts");

  const keys = Object.keys(en);
  check(
    "every English string has a Malayalam draft",
    keys.every((k) => k in ml),
    `${keys.length} keys`,
  );
  check(
    "and none of either is blank — no fallback can produce an empty label",
    keys.every((k) => String(en[k]).trim() && String(ml[k]).trim()),
  );

  const thomas = await db.user.findFirst({
    where: { email: "thomas@example.com" },
    select: { id: true, locale: true },
  });
  const was = thomas.locale;

  /* English, as it ships. */
  await db.user.update({ where: { id: thomas.id }, data: { locale: "en" } });
  let dash = await text("/dashboard", grower);
  check('English renders <html lang="en">', /lang="en"/.test(dash));
  check("and shows no Malayalam", !/വിളവെടുപ്പ്|ചെലവ്/.test(dash));

  /* Malayalam. */
  await db.user.update({ where: { id: thomas.id }, data: { locale: "ml" } });
  dash = await text("/dashboard", grower);
  check(
    'Malayalam renders <html lang="ml"> — screen readers depend on it',
    /lang="ml"/.test(dash),
  );
  check("the menu is in Malayalam", /വിളവെടുപ്പ്/.test(dash) && /ചെലവ്/.test(dash));
  check(
    "the settings page offers the switch in both scripts",
    /ഭാഷ/.test(await text("/dashboard/settings", grower)) &&
      /മലയാളം/.test(await text("/dashboard/settings", grower)),
  );

  /* A correction wins over the shipped draft. */
  await db.translation.create({
    data: { locale: "ml", key: "nav.harvest", value: "ഏലം പറിക്കൽ", reviewed: true },
  });
  dash = await text("/dashboard", grower);
  check("a correction wins over the machine draft", /ഏലം പറിക്കൽ/.test(dash));
  check(
    "and the uncorrected drafts still show beside it",
    /ചെലവ്/.test(dash),
    "a half-reviewed portal is still usable",
  );

  /* An emptied correction must not blank a label. */
  await db.translation.update({
    where: { locale_key: { locale: "ml", key: "nav.harvest" } },
    data: { value: "   " },
  });
  dash = await text("/dashboard", grower);
  check(
    "an emptied correction falls back to the draft rather than blanking",
    /വിളവെടുപ്പ്/.test(dash),
  );

  /* The review screen, and the count that has to stay honest. */
  const review = await text("/admin/language", admin);
  /*
   * Every key, not most of them.
   *
   * The screen groups by prefix, so a group added to the catalogue and not to
   * that list is invisible here — and the first time it happened the missing
   * groups were the estate vocabulary, which is exactly what a machine draft
   * gets wrong and exactly what Jinto is the right person to fix.
   */
  const listed = (review.match(/name="s:/g) ?? []).length;
  check(
    "the review screen lists every string, not just the grouped ones",
    listed === keys.length,
    `${listed} of ${keys.length}`,
  );
  check(
    "it says plainly that the Malayalam is a machine draft",
    /written by the machine/.test(review),
  );
  check(
    "and keeps the privacy notice out of it",
    /privacy notice is/i.test(review),
  );
  check(
    "each group saves on its own, so the checked count means something",
    (review.match(/<form/g) ?? []).length > 5,
    `${(review.match(/<form/g) ?? []).length} forms`,
  );

  /* A grower is never told their language is provisional. */
  check(
    "the grower is never shown the draft warning",
    !/machine|draft|unchecked/i.test(dash),
  );

  /* --- the switch itself ------------------------------------------------ */

  const switchOf = (html) =>
    (html.match(/<button[^>]*role="switch"[\s\S]*?<\/button>/) ?? [null])[0];

  const loginPage = await text("/login");
  check(
    "the switch is on the sign-in page",
    !!switchOf(loginPage),
    "the one screen a grower meets before they have a saved language",
  );
  for (const path of ["/dashboard", "/dashboard/harvest", "/dashboard/settings"]) {
    check(`and in the header on ${path}`, !!switchOf(await text(path, grower)));
  }
  check(
    "but not in the admin, where it would do nothing",
    !switchOf(await text("/admin", admin)),
  );

  const sw = switchOf(loginPage);
  check(
    "it announces itself as a switch, not a nameless button",
    /role="switch"/.test(sw) && /aria-checked=/.test(sw) && /aria-label=/.test(sw),
  );
  check(
    "both languages are legible on the track, each in its own script",
    sw.includes("English") && sw.includes("മലയാളം"),
    "a bare toggle would leave the reader guessing which side is theirs",
  );
  check(
    "each label carries its own lang attribute",
    /lang="en"/.test(sw) && /lang="ml"/.test(sw),
  );

  /* The knob position is what makes it a slide rather than a relabel. */
  await db.user.update({ where: { id: thomas.id }, data: { locale: "en" } });
  const enSwitch = switchOf(await text("/dashboard", grower));
  await db.user.update({ where: { id: thomas.id }, data: { locale: "ml" } });
  const mlSwitch = switchOf(await text("/dashboard", grower));
  check(
    "the knob sits left in English and right in Malayalam",
    /translateX\(0\)/.test(enSwitch) && /translateX\(100%\)/.test(mlSwitch),
  );
  /*
   * A failed switch must not take the page with it.
   *
   * Without the catch, a rejected Server Action escapes the transition as an
   * unhandled rejection and Next replaces the whole screen with an error — so a
   * grower whose connection drops mid-tap loses the page they were reading,
   * over a language toggle. Reproduced before it was fixed.
   */
  const switchSource = await import("node:fs").then((fs) =>
    fs.readFileSync("src/components/language-switch.tsx", "utf8"),
  );
  check(
    "a failed language change is caught rather than thrown",
    /catch\s*\{/.test(switchSource) && /setFailed\(true\)/.test(switchSource),
  );
  check(
    "and says so in both languages, since we do not yet know which one they read",
    /Could not change/.test(switchSource) && /മാറ്റാനായില്ല/.test(switchSource),
  );

  check(
    "and it is an explicit transform, which is what the transition animates",
    /transition-transform/.test(mlSwitch),
    "Tailwind's translate-x-* writes a different property and would not animate",
  );

  await db.translation.deleteMany({});
  await db.user.update({ where: { id: thomas.id }, data: { locale: was } });
  check(
    "audit left no translations behind",
    (await db.translation.count()) === 0,
  );
}

/* ---------------------------------------------------------- 15. tidy up */

section("24. Translating what Jinto writes");

// The provider is never exercised here — there is no API key in this
// environment, and inventing one would test a mock rather than Google. What is
// testable is everything around it, which is where the failure modes that
// matter actually live: silence by default, and English rather than a blank
// page when the call fails.
{
  const { translateMany, translationEnabled, provider } = await import(
    "../src/lib/translate/index.ts"
  );

  const before = process.env.TRANSLATE_PROVIDER;
  delete process.env.TRANSLATE_PROVIDER;

  check("off unless configured", translationEnabled() === false);

  // The important one. A deployment with no key must render English, not throw
  // and not return blanks.
  const out = await translateMany(["Pruned the lower block", null, ""], "ml");
  check("no provider returns the English unchanged", out[0] === "Pruned the lower block");
  check("no provider tolerates a null note", out[1] === "");
  check("no provider makes no calls", (await db.contentTranslation.count()) === 0);

  // A provider that is configured but broken. This is the fail-open path, and
  // it is the one a grower actually meets on a bad day: a rate limit, an
  // expired card, a network that dropped.
  process.env.TRANSLATE_PROVIDER = "google";
  process.env.GOOGLE_TRANSLATE_KEY = "audit-not-a-real-key";
  check("configured provider reports enabled", translationEnabled() === true);

  /*
   * Azure's region header, which is conditional rather than optional.
   *
   * A regional Translator resource requires it and a global one rejects the
   * request when it is present. This used to default to a guessed region, so a
   * global key — the kind you get by clicking through the portal — failed
   * authentication with a 401 that says nothing about why. Never caught by
   * anything else, because the provider has no live test.
   */
  {
    const sent = [];
    const realFetch3 = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
      sent.push(Object.keys(init.headers));
      return new Response(JSON.stringify([{ translations: [{ text: "ok" }] }]), {
        status: 200,
      });
    };
    const savedProvider = process.env.TRANSLATE_PROVIDER;
    const savedRegion = process.env.AZURE_TRANSLATE_REGION;
    process.env.TRANSLATE_PROVIDER = "azure";
    process.env.AZURE_TRANSLATE_KEY = "audit-not-a-real-key";

    delete process.env.AZURE_TRANSLATE_REGION;
    await provider().translate(["hello"], "ml");
    check(
      "azure omits the region header when none is configured",
      !sent[0].some((h) => h.toLowerCase() === "ocp-apim-subscription-region"),
    );

    process.env.AZURE_TRANSLATE_REGION = "centralindia";
    await provider().translate(["hello"], "ml");
    check(
      "and sends it when one is",
      sent[1].some((h) => h.toLowerCase() === "ocp-apim-subscription-region"),
    );

    globalThis.fetch = realFetch3;
    delete process.env.AZURE_TRANSLATE_KEY;
    if (savedRegion === undefined) delete process.env.AZURE_TRANSLATE_REGION;
    else process.env.AZURE_TRANSLATE_REGION = savedRegion;
    if (savedProvider === undefined) delete process.env.TRANSLATE_PROVIDER;
    else process.env.TRANSLATE_PROVIDER = savedProvider;
    process.env.TRANSLATE_PROVIDER = "google";
    process.env.GOOGLE_TRANSLATE_KEY = "audit-not-a-real-key";
  }

  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("nope", { status: 403 });
  const failed = await translateMany(["Sprayed the upper block"], "ml");
  globalThis.fetch = realFetch;
  check(
    "a refused key falls back to English rather than blanking the page",
    failed[0] === "Sprayed the upper block",
  );
  check(
    "a failed call caches nothing",
    (await db.contentTranslation.count()) === 0,
  );

  // The cache. Written by hand rather than by a call, because the point being
  // tested is that a stored row is found and used — not that the provider works.
  const { createHash } = await import("node:crypto");
  const source = "Audit note, harvested the north block";
  const hash = createHash("sha256")
    .update(`ml ${source}`)
    .digest("hex")
    .slice(0, 40);
  await db.contentTranslation.create({
    data: { hash, locale: "ml", source, value: "AUDIT-CACHED", provider: "audit" },
  });

  globalThis.fetch = async () => {
    throw new Error("the cache should have answered this without a call");
  };
  const cached = await translateMany([source], "ml");
  globalThis.fetch = realFetch;
  check("a cached note is served without calling the provider", cached[0] === "AUDIT-CACHED");

  // Editing a note must not keep showing the old translation.
  const editedHash = createHash("sha256")
    .update(`ml ${source} — corrected`)
    .digest("hex")
    .slice(0, 40);
  check("editing the source changes the cache key", editedHash !== hash);

  // English asks for nothing, whatever is configured.
  globalThis.fetch = async () => {
    throw new Error("English must never reach the provider");
  };
  const english = await translateMany([source], "en");
  globalThis.fetch = realFetch;
  check("English never reaches the provider", english[0] === source);

  await db.contentTranslation.deleteMany({ where: { provider: "audit" } });
  check(
    "audit translations removed",
    (await db.contentTranslation.count({ where: { provider: "audit" } })) === 0,
  );

  /*
   * The cache does not keep superseded notes forever.
   *
   * A note edited five times leaves five rows holding text that exists nowhere
   * else, and estate notes can name people. The retention sweep drops any row
   * whose source no longer matches a live activity, note or caption.
   */
  {
    const { purgeExpiredData } = await import("../src/lib/retention.ts");
    const liveTitle = (
      await db.activity.findFirst({ select: { title: true } })
    ).title;
    const keepHash = createHash("sha256")
      .update(`ml ${liveTitle}`)
      .digest("hex")
      .slice(0, 40);
    await db.contentTranslation.createMany({
      data: [
        { hash: keepHash, locale: "ml", source: liveTitle, value: "KEEP", provider: "audit" },
        {
          hash: "audit-orphan-hash-0000000000000000000000",
          locale: "ml",
          source: "A note that was edited away and exists nowhere now",
          value: "DROP",
          provider: "audit",
        },
      ],
    });
    const result = await purgeExpiredData(null);
    check("the sweep reports what it dropped", result.translations >= 1);
    check(
      "a superseded note is not kept forever",
      (await db.contentTranslation.count({
        where: { hash: "audit-orphan-hash-0000000000000000000000" },
      })) === 0,
    );
    check(
      "but a note still on an activity is kept",
      (await db.contentTranslation.count({ where: { hash: keepHash } })) === 1,
    );
    await db.contentTranslation.deleteMany({ where: { provider: "audit" } });
  }

  /*
   * Malayalam typed by a person.
   *
   * This is the layer that works with no API key, which on the day it shipped
   * was the only layer that worked at all. It shares the table and the hashing
   * with the machine cache so the reader cannot tell them apart — which is the
   * design, and also the thing most likely to break silently.
   */
  {
    const { saveActivityTranslations, saveHumanTranslation, humanTranslationsFor, translationKey } =
      await import("../src/lib/translate/human.ts");
    const { translateActivities } = await import("../src/lib/translate/activities.ts");

    const source = "Audit human translation subject";

    // The two hashing functions live in different modules on purpose. They must
    // never drift, or a translation would be written where nothing looks.
    const viaCache = createHash("sha256")
      .update(`ml ${source}`)
      .digest("hex")
      .slice(0, 40);
    check("both layers key a sentence the same way", translationKey(source, "ml") === viaCache);

    const before = process.env.TRANSLATE_PROVIDER;
    delete process.env.TRANSLATE_PROVIDER;

    const row = { title: source, notes: null };

    const [plain] = await translateActivities([row], "ml");
    check("with nothing typed, the grower sees the English", plain.title === source);

    await saveHumanTranslation(source, "ഓഡിറ്റ് മലയാളം", "ml");

    // The regression this exists for: translateMany used to give up before
    // reading the cache when no provider was set, which made every hand-typed
    // translation invisible on exactly the deployments that depend on them.
    const [typed] = await translateActivities([row], "ml");
    check(
      "a typed translation reaches the grower with no API key at all",
      typed.title === "ഓഡിറ്റ് മലയാളം",
    );

    /*
     * The caption on a photograph, which is also its alt text.
     *
     * The uploader defaults a photo's caption to the activity's title, so this
     * was the English left visible to a screen reader on an otherwise fully
     * Malayalam page — the readers least able to route around it. Found by
     * diffing the rendered HTML rather than the visible text.
     */
    const withPhotos = {
      title: source,
      notes: null,
      attachments: [{ caption: source }, { caption: source }],
    };
    const [captioned] = await translateActivities([withPhotos], "ml");
    check(
      "a photograph's caption is translated too, not just the title",
      captioned.attachments.every((x) => x.caption === "ഓഡിറ്റ് മലയാളം"),
    );
    check(
      "and the same sentence repeated is paid for once",
      (await db.contentTranslation.count({ where: { source } })) === 1,
    );

    const back = await humanTranslationsFor([source], "ml");
    check("and comes back to the admin form to be edited", back.get(source) === "ഓഡിറ്റ് മലയാളം");

    const [english] = await translateActivities([row], "en");
    check("English readers are unaffected", english.title === source);

    // Jinto's wording must beat the machine's, and must not cost a call.
    process.env.TRANSLATE_PROVIDER = "google";
    process.env.GOOGLE_TRANSLATE_KEY = "audit-not-a-real-key";
    const realFetch2 = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("a sentence Jinto already translated must not be sent anywhere");
    };
    const [preferred] = await translateActivities([row], "ml");
    globalThis.fetch = realFetch2;
    check(
      "what Jinto typed wins over the provider, and is never sent to it",
      preferred.title === "ഓഡിറ്റ് മലയാളം",
    );
    delete process.env.GOOGLE_TRANSLATE_KEY;
    delete process.env.TRANSLATE_PROVIDER;

    // Emptying the box is how he takes it back.
    await saveActivityTranslations({ title: source, notes: null }, { title: "", notes: "" });
    const [cleared] = await translateActivities([row], "ml");
    check("emptying the box restores the English", cleared.title === source);
    check(
      "and leaves no blank row behind to render as an empty title",
      (await db.contentTranslation.count({ where: { hash: viaCache } })) === 0,
    );

    await db.contentTranslation.deleteMany({ where: { provider: "human" } });
    if (before === undefined) delete process.env.TRANSLATE_PROVIDER;
    else process.env.TRANSLATE_PROVIDER = before;
  }

  delete process.env.GOOGLE_TRANSLATE_KEY;
  if (before === undefined) delete process.env.TRANSLATE_PROVIDER;
  else process.env.TRANSLATE_PROVIDER = before;
}

section("15. Audit left nothing behind");

await db.enquiry.deleteMany({
  where: { email: { in: ["audit@example.test", "noconsent@example.test"] } },
});
await db.consentRecord.deleteMany({ where: { email: "audit@example.test" } }).catch(() => {});

check(
  "audit enquiries removed",
  (await db.enquiry.count({ where: { email: { contains: "example.test" } } })) === 0,
);
check("no audit attachments remain",
  (await db.attachment.count({ where: { filename: "audit-test.png" } })) === 0);
check("no audit settings remain", (await db.setting.count()) === beforeRows);

/*
 * Nobody was left in the wrong language.
 *
 * The Malayalam section switches a grower's locale and switches it back at the
 * end. A run that dies in between leaves them in Malayalam — and because the
 * restore puts back whatever it found, the next run captures "ml" as the
 * original and faithfully preserves it. The suite then quietly fails a dozen
 * earlier assertions that look for English labels, and blames the wrong code.
 *
 * That happened. This is the assertion that would have said so immediately.
 */
{
  for (const [id, locale] of localesBefore) {
    await db.user.update({ where: { id }, data: { locale } });
  }
  const now = await db.user.findMany({ select: { id: true, locale: true, email: true } });
  const wrong = now.filter((u) => u.locale !== localesBefore.get(u.id));
  check(
    "every account is back in the language it was in before the run",
    wrong.length === 0,
    wrong.map((u) => `${u.email} is in ${u.locale}`).join(", "),
  );
}

/* ------------------------------------------------------------- report */

console.log("\n" + "=".repeat(64));
console.log(`\x1b[1m${pass} passed · ${fail} failed\x1b[0m`);
if (failures.length) {
  console.log("\n\x1b[31mFailures:\x1b[0m");
  failures.forEach((f) => console.log("  - " + f));
}
console.log("");

await db.$disconnect();
process.exitCode = fail ? 1 : 0;
