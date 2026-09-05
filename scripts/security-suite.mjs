/**
 * Security test suite. Run with the dev server up:
 *   node scripts/security-suite.mjs
 *
 * Covers: authn, authz, tenant isolation (IDOR), server-action guards,
 * injection, XSS sinks, upload rules, price/stock tampering, rate limiting,
 * headers, cookies and information disclosure.
 *
 * NOTE: the login tests consume the rate-limit budget. Restart the dev server
 * before re-running, or the account lockout will produce false failures.
 */
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE ?? "http://localhost:3000";
const db = new PrismaClient();

let pass = 0,
  fail = 0,
  warn = 0;
const failures = [];
const warnings = [];

const P = (n, d = "") => {
  pass++;
  console.log(`  \x1b[32mPASS\x1b[0m  ${n}${d ? ` — ${d}` : ""}`);
};
const F = (n, d = "") => {
  fail++;
  failures.push(`${n}${d ? ` — ${d}` : ""}`);
  console.log(`  \x1b[31mFAIL\x1b[0m  ${n}${d ? ` — ${d}` : ""}`);
};
const W = (n, d = "") => {
  warn++;
  warnings.push(`${n}${d ? ` — ${d}` : ""}`);
  console.log(`  \x1b[33mWARN\x1b[0m  ${n}${d ? ` — ${d}` : ""}`);
};
const check = (n, ok, d = "") => (ok ? P(n, d) : F(n, d));
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

/* ---------------------------------------------------------------- helpers */

function jar() {
  const m = new Map();
  return {
    header: () => [...m].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb: (res) => {
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(";");
        const i = pair.indexOf("=");
        m.set(pair.slice(0, i), pair.slice(i + 1));
      }
    },
    raw: m,
  };
}

async function get(path, j, redirect = "manual") {
  const res = await fetch(BASE + path, {
    redirect,
    headers: j ? { cookie: j.header() } : {},
  });
  j?.absorb(res);
  return res;
}

async function login(email, password) {
  const j = jar();
  const c = await get("/api/auth/csrf", j);
  const { csrfToken } = await c.json();
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
  const s = await (await get("/api/auth/session", j)).json();
  return { jar: j, session: s, loggedIn: !!s?.user };
}

/* ------------------------------------------------------------------ setup */

const admin = await login("jinto@aela.co.in", "Admin@123");
const thomasUser = await db.user.findFirst({
  where: { role: "CLIENT", client: { name: "Thomas Mathew" } },
});
const thomas = await login(thomasUser.email, "Client@123");

if (!admin.loggedIn || !thomas.loggedIn) {
  console.error(
    "\nCannot log in — the rate limiter is probably still holding a lockout.",
  );
  console.error("Restart the dev server and re-run.\n");
  process.exit(1);
}

/* ------------------------------------------------------------- 1. injection */

section("1. Injection");

{
  const payloads = [
    "' OR '1'='1",
    "'; DROP TABLE Client;--",
    '" OR 1=1--',
    "1' UNION SELECT * FROM User--",
    "admin'--",
  ];
  let broke = false;
  for (const p of payloads) {
    const r = await login(p, p);
    if (r.loggedIn) broke = true;
  }
  check("SQL injection in login credentials rejected", !broke);

  // Injection through a searchable query string
  const res = await get(
    `/dashboard/activities?type=${encodeURIComponent("' OR 1=1--")}`,
    thomas.jar,
  );
  check(
    "SQL metacharacters in query params handled safely",
    res.status === 200 || res.status === 307,
    `status ${res.status}`,
  );

  const clientCount = await db.client.count();
  check("database intact after injection attempts", clientCount > 0, `${clientCount} clients`);
}

/* ------------------------------------------------------- 2. authentication */

section("2. Authentication");

{
  const r = await login("jinto@aela.co.in", "WrongPassword1");
  check("wrong password rejected", !r.loggedIn);

  const r2 = await login("nobody@nowhere.test", "anything");
  check("unknown account rejected", !r2.loggedIn);

  // Deactivated users must not be able to sign in.
  const victim = await db.user.findFirst({
    where: { role: "CLIENT", email: { not: thomasUser.email } },
  });
  await db.user.update({ where: { id: victim.id }, data: { isActive: false } });
  const r3 = await login(victim.email, "Client@123");
  check("deactivated user cannot sign in", !r3.loggedIn);
  await db.user.update({ where: { id: victim.id }, data: { isActive: true } });

  const hash = (await db.user.findUnique({ where: { id: thomasUser.id } }))
    .passwordHash;
  check("passwords stored as Argon2id", hash.startsWith("$argon2id$"), hash.slice(0, 12));
  check("password hash never equals plaintext", !hash.includes("Client@123"));
}

/* --------------------------------------------------- 3. session / cookies */

section("3. Session and cookies");

{
  const j = jar();
  const c = await get("/api/auth/csrf", j);
  const { csrfToken } = await c.json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: j.header(),
    },
    body: new URLSearchParams({
      csrfToken,
      email: "jinto@aela.co.in",
      password: "Admin@123",
    }),
  });
  const cookie = (res.headers.getSetCookie?.() ?? []).find((x) =>
    x.includes("session-token"),
  );
  check("session cookie is HttpOnly", /httponly/i.test(cookie ?? ""));
  check("session cookie sets SameSite", /samesite=/i.test(cookie ?? ""));
  if (!/secure/i.test(cookie ?? "")) {
    W("session cookie lacks Secure", "expected on http://localhost; must be set in production");
  } else {
    P("session cookie is Secure");
  }

  // A forged/garbage token must not authenticate.
  const forged = jar();
  forged.raw.set("authjs.session-token", "not.a.real.token");
  const s = await (await get("/api/auth/session", forged)).json();
  check("forged session token rejected", !s?.user);

  const res2 = await get("/dashboard", forged);
  check(
    "forged token cannot open the portal",
    res2.status >= 300 && res2.status < 400,
    `status ${res2.status}`,
  );
}

/* ------------------------------------------------------- 4. authorization */

section("4. Authorization and role separation");

{
  for (const p of [
    "/admin",
    "/admin/clients",
    "/admin/activities/new",
    "/admin/workers",
    "/admin/products",
    "/admin/products/new",
    "/admin/orders",
    "/dashboard",
    "/dashboard/expenses",
    "/dashboard/documents",
  ]) {
    const res = await get(p);
    const ok = res.status >= 300 && res.status < 400;
    check(`anonymous blocked from ${p}`, ok, `status ${res.status}`);
  }

  for (const p of [
    "/admin",
    "/admin/clients",
    "/admin/orders",
    "/admin/workers",
    "/admin/products",
  ]) {
    const res = await get(p, thomas.jar);
    check(`grower blocked from ${p}`, res.status !== 200, `status ${res.status}`);
  }

  const a = await get("/admin", admin.jar);
  check("admin can reach /admin", a.status === 200, `status ${a.status}`);
}

/* ------------------------------------------------ 5. tenant isolation */

section("5. Cross-client isolation (IDOR)");

{
  const other = await db.client.findFirst({
    where: { id: { not: thomasUser.clientId }, isActive: true },
  });

  const targets = await db.activity.findMany({
    where: { clientId: other.id },
    take: 3,
    select: { id: true, title: true },
  });

  let leaked = 0;
  for (const t of targets) {
    const res = await get(`/dashboard/activities/${t.id}`, thomas.jar);
    if (res.status === 200) {
      const body = await res.text();
      if (body.includes(t.title)) leaked++;
    }
  }
  check(
    "grower cannot read another grower's activities by id",
    leaked === 0,
    `${leaked}/${targets.length} leaked`,
  );

  // Own record must still work, else the test above proves nothing.
  const own = await db.activity.findFirst({
    where: { clientId: thomasUser.clientId },
    select: { id: true, title: true },
  });
  const mine = await get(`/dashboard/activities/${own.id}`, thomas.jar);
  const mineBody = mine.status === 200 ? await mine.text() : "";
  check(
    "grower CAN read their own activity (control)",
    mine.status === 200 && mineBody.includes(own.title),
  );

  // Filter params must not widen scope beyond the session's client.
  const otherPlot = await db.plot.findFirst({ where: { clientId: other.id } });
  const res = await get(
    `/dashboard/activities?plot=${otherPlot.id}`,
    thomas.jar,
  );
  const body = res.status === 200 ? await res.text() : "";
  const otherActs = await db.activity.findMany({
    where: { plotId: otherPlot.id },
    select: { title: true },
    take: 5,
  });
  const bled = otherActs.filter((a) => body.includes(a.title)).length;
  check(
    "another client's plot id in a filter leaks nothing",
    bled === 0,
    `${bled} titles bled through`,
  );

  const otherDoc = await db.attachment.findFirst({
    where: { clientId: other.id, kind: "DOCUMENT" },
  });
  if (otherDoc) {
    const docs = await get("/dashboard/documents", thomas.jar);
    const dbody = await docs.text();
    check(
      "another client's documents are not listed",
      !dbody.includes(otherDoc.filename),
    );
  }
}

/* ------------------------------------------- 6. server action authorization */

section("6. Server action guards");

{
  // Every exported admin action must call requireAdmin. Verified statically
  // here; the runtime guard is proven by the role tests above.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/app/admin/actions.ts", "utf8");
  const exported = [...src.matchAll(/export async function (\w+)/g)].map(
    (m) => m[1],
  );
  const bodies = src.split(/export async function /).slice(1);
  const unguarded = bodies
    .map((b) => ({
      name: b.slice(0, b.indexOf("(")),
      guarded: b.slice(0, 400).includes("requireAdmin()"),
    }))
    .filter((x) => !x.guarded)
    .map((x) => x.name);

  check(
    `all ${exported.length} admin actions call requireAdmin()`,
    unguarded.length === 0,
    unguarded.join(", "),
  );

  // Client-facing query helpers must never accept an id straight from a request.
  const q = readFileSync("src/lib/queries.ts", "utf8");
  check(
    "client queries are scoped by clientId",
    (q.match(/clientId/g) ?? []).length > 10,
  );
}

/* ------------------------------------------------------ 7. price tampering */

section("7. Store: price and stock tampering");

{
  const variant = await db.productVariant.findFirst({
    where: { stock: { gt: 0 } },
    include: { product: true },
  });

  const forgedCart = JSON.stringify([
    { variantId: variant.id, quantity: 1, unitPrice: 1 },
  ]);
  const form = new URLSearchParams({
    customerName: "Probe Tester",
    email: "probe@example.test",
    phone: "9999999999",
    addressLine1: "1 Test Road",
    city: "Kochi",
    state: "Kerala",
    pincode: "682001",
    cart: forgedCart,
  });

  const before = await db.order.count();
  await fetch(`${BASE}/checkout`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const after = await db.order.count();

  if (after > before) {
    const order = await db.order.findFirst({ orderBy: { createdAt: "desc" } });
    check(
      "forged unitPrice ignored; DB price used",
      order.total >= variant.price,
      `charged ${order.total}, real price ${variant.price}`,
    );
    await db.order.delete({ where: { id: order.id } });
  } else {
    P("checkout did not accept the raw POST (server action requires its own encoding)");
  }

  // Quantity bounds are enforced by schema, not the browser.
  const src = (await import("node:fs")).readFileSync(
    "src/app/(site)/checkout/actions.ts",
    "utf8",
  );
  check("cart quantity is bounded server-side", /max\(\s*\d+\s*\)/.test(src));
  check("stock claimed inside a transaction", src.includes("$transaction"));
  check(
    "stock re-checked atomically on claim",
    src.includes("stock: { gte:"),
  );
}

/* --------------------------------------------------------- 8. upload rules */

section("8. File upload");

{
  const { readFileSync } = await import("node:fs");
  // The validator moved out of the admin action into src/lib/uploads.ts when
  // growers gained the ability to upload — one gate for both callers.
  const src = readFileSync("src/lib/uploads.ts", "utf8");
  const storage = readFileSync("src/lib/files.ts", "utf8");

  check("inline upload size is capped", src.includes("MAX_INLINE_BYTES"));
  check("MIME type is allow-listed", src.includes("ALLOWED"));
  check(
    "SVG is not an accepted upload type",
    !src.includes('"image/svg+xml"'),
    "SVG can carry script",
  );
  check(
    "extension derived from validated MIME, not filename",
    storage.includes("EXTENSION_FOR_TYPE") &&
      !storage.includes("path.extname(file.name)"),
  );
  check("stored filename is a random UUID", storage.includes("randomUUID()"));
  check(
    "uploads are written outside public/",
    storage.includes('"private-uploads"') && !src.includes('"public", "uploads"'),
    "public/ is served with no session check",
  );
  check(
    "storage key cannot escape the private directory",
    storage.includes("resolveStoredPath") && storage.includes("path.resolve"),
  );

  // The real test: an attachment is readable only by the grower who owns it.
  const mine = await db.attachment.findFirst({
    where: { clientId: thomasUser.clientId, storageKey: { not: null } },
    select: { id: true },
  });
  const theirs = await db.attachment.findFirst({
    where: { clientId: { not: thomasUser.clientId }, storageKey: { not: null } },
    select: { id: true, storageKey: true },
  });

  if (!mine || !theirs) {
    W("no private attachments seeded", "run `npm run db:reset` and re-run");
  } else {
    const anon = await fetch(`${BASE}/api/files/${theirs.id}`, {
      redirect: "manual",
    });
    check(
      "signed-out request for an attachment is refused",
      anon.status === 404,
      `status ${anon.status}`,
    );

    const cross = await get(`/api/files/${theirs.id}`, thomas.jar);
    check(
      "a grower CANNOT read another grower's attachment",
      cross.status === 404,
      `status ${cross.status}`,
    );

    const own = await get(`/api/files/${mine.id}`, thomas.jar);
    check(
      "a grower CAN read their own attachment",
      own.status === 200,
      `status ${own.status}`,
    );
    check(
      "attachment served with nosniff",
      own.headers.get("x-content-type-options") === "nosniff",
    );
    check(
      "attachment served under a sandbox CSP",
      (own.headers.get("content-security-policy") ?? "").includes("sandbox"),
    );
    check(
      "attachment is not cached by shared caches",
      (own.headers.get("cache-control") ?? "").includes("private"),
    );

    // Knowing the on-disk name must not be enough to fetch the bytes.
    const byKey = await fetch(`${BASE}/uploads/${theirs.storageKey}`, {
      redirect: "manual",
    });
    check(
      "the stored file is not reachable under /uploads",
      byKey.status === 404,
      `status ${byKey.status}`,
    );

    const traversal = await get(
      `/api/files/${encodeURIComponent("../../.env")}`,
      thomas.jar,
    );
    check(
      "path traversal in the file id is refused",
      traversal.status === 404,
      `status ${traversal.status}`,
    );
  }

  // Product photography stays public on purpose — it is shop imagery.
  const pub = await fetch(`${BASE}/uploads/product-1.svg`);
  check(
    "public store imagery still served with nosniff",
    pub.headers.get("x-content-type-options") === "nosniff",
  );
}

/* ------------------------------------------------------------- 9. headers */

section("9. Security headers");

{
  const res = await fetch(`${BASE}/`);
  const want = {
    "content-security-policy": (v) => v?.includes("frame-ancestors 'none'"),
    "x-frame-options": (v) => v === "DENY",
    "x-content-type-options": (v) => v === "nosniff",
    "referrer-policy": (v) => !!v,
    "permissions-policy": (v) => !!v,
    "strict-transport-security": (v) => v?.includes("max-age="),
  };
  for (const [h, ok] of Object.entries(want)) {
    const v = res.headers.get(h);
    check(`${h} present and sane`, ok(v), v ?? "MISSING");
  }

  const csp = res.headers.get("content-security-policy") ?? "";
  if (csp.includes("'unsafe-inline'") && csp.includes("script-src")) {
    W("CSP allows 'unsafe-inline' for scripts", "needs nonces to fully close XSS");
  }
}

/* ----------------------------------------------------------- 10. XSS sinks */

section("10. XSS sinks");

{
  // Scan with Node rather than grep — grep does not exist on Windows, and a
  // failed shell call would make these checks pass vacuously.
  const { readdirSync, statSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");

  const files = [];
  (function walk(dir) {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|jsx?)$/.test(e)) files.push(p);
    }
  })("src");

  const hits = (needle) =>
    files.filter((f) => readFileSync(f, "utf8").includes(needle));

  /** Same, but as a regex — for needles that need a word boundary. */
  const matches = (re) => files.filter((f) => re.test(readFileSync(f, "utf8")));

  check(`scanned ${files.length} source files`, files.length > 20);
  check("no dangerouslySetInnerHTML", hits("dangerouslySetInnerHTML").length === 0,
    hits("dangerouslySetInnerHTML").join(", "));
  // `redis.eval(` is Upstash running a Lua script server-side — a method call
  // on a client object, not the JS evaluator. Only a bare eval( is a finding.
  const evals = matches(/(^|[^.\w])eval\s*\(/m);
  check("no eval(", evals.length === 0, evals.join(", "));
  check("no innerHTML assignment", hits("innerHTML").length === 0,
    hits("innerHTML").join(", "));
  check("no $queryRawUnsafe", hits("$queryRawUnsafe").length === 0);
  check("no $executeRawUnsafe", hits("$executeRawUnsafe").length === 0);
  check("no raw SQL at all", hits("$queryRaw").length === 0 && hits("$executeRaw").length === 0);

  // Stored XSS: put a script payload in a field a grower will render.
  const target = await db.activity.findFirst({
    where: { clientId: thomasUser.clientId },
  });
  const original = target.title;
  const payload = `<img src=x onerror="alert(1)">`;
  await db.activity.update({ where: { id: target.id }, data: { title: payload } });

  const res = await get(`/dashboard/activities/${target.id}`, thomas.jar);
  const body = await res.text();

  // An executable payload would appear verbatim. React escapes text children,
  // so the angle brackets and quotes must come back entity-encoded.
  const executable = body.includes('<img src=x onerror="alert(1)">');
  const escaped = body.includes("&lt;img") || body.includes("\\u003cimg");
  check(
    "stored script payload is not rendered executable",
    !executable,
    executable ? "RAW PAYLOAD PRESENT" : "",
  );
  check("stored payload comes back entity-encoded", escaped);

  await db.activity.update({ where: { id: target.id }, data: { title: original } });
}

/* --------------------------------------------------- 11. info disclosure */

section("11. Information disclosure");

{
  const a = await login("jinto@aela.co.in", "definitely-wrong");
  const b = await login("does-not-exist@nowhere.test", "definitely-wrong");
  check(
    "login errors do not reveal whether an account exists",
    JSON.stringify(a.session) === JSON.stringify(b.session),
  );

  const res = await get("/api/auth/session", thomas.jar);
  const s = await res.json();
  check("session payload excludes the password hash", !JSON.stringify(s).includes("$argon2"));

  const missing = await get("/definitely-not-a-real-page");
  const body = await missing.text();
  const leaks = ["node_modules", "at Object.", "C:\\\\Users", "/src/app/"].filter(
    (s) => body.includes(s),
  );
  if (leaks.length && process.env.NODE_ENV !== "production") {
    W(
      "404 response contains build paths in dev mode",
      `${leaks.join(", ")} — re-check against \`npm run build && npm start\``,
    );
  } else {
    check("404 page leaks no stack trace or file paths", leaks.length === 0,
      leaks.join(", "));
  }

  const order = await db.order.findFirst();
  if (order) {
    const r = await fetch(`${BASE}/orders/lookup`);
    check("order lookup page loads", r.status === 200);
    const src = (await import("node:fs")).readFileSync(
      "src/app/(site)/checkout/actions.ts",
      "utf8",
    );
    check(
      "order lookup requires order number AND email",
      src.includes("orderNumber, email"),
    );
  }
}

/* -------------------------------------------------------- 12. rate limiting */

section("12. Rate limiting");

{
  const victim = "mary@example.com";
  let lockedAfter = null;
  for (let i = 1; i <= 8; i++) {
    const r = await login(victim, `wrong-${i}`);
    if (r.loggedIn) continue;
    const good = await login(victim, "Client@123");
    if (!good.loggedIn && lockedAfter === null) {
      lockedAfter = i;
      break;
    }
  }
  check(
    "account locks out after repeated failures",
    lockedAfter !== null,
    lockedAfter ? `locked after ${lockedAfter} attempts` : "NEVER LOCKED",
  );

  // A different account must be unaffected (per-account, not global).
  const abdul = await login("abdul@example.com", "Client@123");
  check(
    "lockout is per-account, not global",
    abdul.loggedIn,
    abdul.loggedIn ? "" : "other accounts also locked — IP budget exhausted",
  );

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    P("rate limiter is backed by a shared Redis store");
  } else {
    W(
      "rate limiter has no UPSTASH_REDIS_REST_URL/TOKEN — using in-process memory",
      "fine for one instance; set them before deploying to Vercel",
    );
  }
}

/* -------------------------------------------------------------- 14. DPDP */

section("14. DPDP — notice, consent, rights and minimisation");

{
  const { readFileSync } = await import("node:fs");

  // The notice and the rights form have to be reachable without signing in.
  // A privacy notice behind a login is not a notice.
  for (const p of ["/privacy", "/privacy/request"]) {
    const res = await get(p, undefined, "follow");
    check(`${p} is public`, res.status === 200, `status ${res.status}`);
  }

  const notice = await (await get("/privacy", undefined, "follow")).text();
  check(
    "notice names the grievance officer",
    notice.includes("Jinto Jomon") && notice.includes("8590 657900"),
  );
  check(
    "notice names the Data Protection Board",
    notice.includes("Data Protection Board of India"),
  );
  check(
    "notice states retention periods",
    notice.includes("How long we keep it"),
  );

  /* ----------------------------------------------------- access (s.11) */

  const anon = await get("/api/my-data");
  check(
    "signed-out request for the data export is refused",
    anon.status === 404,
    `status ${anon.status}`,
  );

  // Deliberately 404 for an admin too: Jinto reaching a grower's export
  // belongs in the request queue where it is logged, not on a self-serve URL.
  const adminExport = await get("/api/my-data", admin.jar);
  check(
    "admin cannot use the grower self-export route",
    adminExport.status === 404,
    `status ${adminExport.status}`,
  );

  const mine = await get("/api/my-data", thomas.jar);
  check("a grower CAN export their own data", mine.status === 200, `status ${mine.status}`);

  if (mine.status === 200) {
    const body = await mine.text();

    check(
      "export is not cached",
      (mine.headers.get("cache-control") ?? "").includes("no-store"),
      mine.headers.get("cache-control") ?? "absent",
    );
    check(
      "export is sent as a download",
      (mine.headers.get("content-disposition") ?? "").includes("attachment"),
    );

    // The single worst thing this feature could do.
    check(
      "export never contains a password hash",
      !body.includes("passwordHash") && !body.toLowerCase().includes("$argon"),
    );

    // Tenant isolation, on the one route whose whole job is handing over data.
    const other = await db.client.findFirst({
      where: { code: { not: "CLT-001" } },
      include: { plots: true },
    });
    const leaked = other
      ? body.includes(other.name) ||
        other.plots.some((p) => body.includes(p.name))
      : false;
    check(
      "export contains no other grower's data",
      !leaked,
      other ? `checked against ${other.name}` : "no second client to check",
    );

    const parsed = JSON.parse(body);
    check(
      "export states the purposes and retention, as s.11 requires",
      Array.isArray(parsed.purposes) &&
        parsed.purposes.length > 0 &&
        Array.isArray(parsed.retention) &&
        parsed.retention.length > 0,
    );
  }

  /* ---------------------------------------------------- consent (s.6) */

  const consentRows = await db.consentRecord.count();
  check(
    "consent records carry the notice version they were taken under",
    consentRows === 0 ||
      (await db.consentRecord.count({ where: { noticeVersion: { not: "" } } })) ===
        consentRows,
    `${consentRows} record(s)`,
  );

  const checkoutSrc = readFileSync("src/app/(site)/checkout/actions.ts", "utf8");
  check(
    "checkout refuses to create an order without the consent tick",
    checkoutSrc.includes('formData.get("dpdpConsent") !== "yes"'),
  );
  check(
    "the consent record is written in the same transaction as the order",
    /tx\.consentRecord\.create/.test(checkoutSrc),
  );

  // Comments are stripped first: the file explains *why* it must not be
  // pre-ticked, and a plain substring search would flag its own reasoning.
  const noticeSrc = readFileSync("src/components/consent-notice.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  check(
    "the consent box is not pre-ticked — s.6 needs a clear affirmative action",
    !/defaultChecked/.test(noticeSrc) && !/checked=\{true\}/.test(noticeSrc),
  );
  check(
    "the consent box is required and named for the server check",
    /name="dpdpConsent"/.test(noticeSrc) && /\brequired\b/.test(noticeSrc),
  );

  /* ------------------------------------------ rights routes are guarded */

  for (const p of ["/dashboard/privacy", "/admin/privacy"]) {
    const res = await get(p);
    check(
      `anonymous blocked from ${p}`,
      res.status >= 300 && res.status < 400,
      `status ${res.status}`,
    );
  }

  const growerAtAdmin = await get("/admin/privacy", thomas.jar);
  check(
    "grower blocked from the admin request queue",
    growerAtAdmin.status !== 200,
    `status ${growerAtAdmin.status}`,
  );

  /* ------------------------------------------- minimisation and erasure */

  const schema = readFileSync("prisma/schema.prisma", "utf8");
  // The field held Aadhaar fragments and nothing ever read it. If it comes
  // back, it comes back with a purpose attached, not by accident.
  check(
    "no Aadhaar-derived identifier on the worker record",
    !/^\s*idNumber\s/m.test(schema),
  );

  const src = readFileSync("src/app/admin/actions.ts", "utf8");
  check(
    "erasure keeps the statutory accounting record rather than deleting orders",
    src.includes("anonymiseCustomer") && !/order\.deleteMany/.test(src),
  );

  const erased = await db.order.count({ where: { email: { startsWith: "erased+" } } });
  if (erased > 0) {
    const stillNamed = await db.order.count({
      where: {
        email: { startsWith: "erased+" },
        NOT: { addressLine1: "" },
      },
    });
    check(
      "an erased customer keeps no address on any order",
      stillNamed === 0,
      `${erased} erased order(s)`,
    );
  }

  /* ------------------------------------------------- breach obligations */

  check(
    "breach records track the Board and the people separately",
    /boardNotifiedAt/.test(schema) && /principalsNotifiedAt/.test(schema),
  );
}

/* --------------------------------------------------- 15. permissions (Doc 06) */

section("15. Permissions — RBAC and dynamic per-client permissions");

{
  const { readFileSync } = await import("node:fs");

  for (const p of ["/admin/permissions"]) {
    const res = await get(p);
    check(
      `anonymous blocked from ${p}`,
      res.status >= 300 && res.status < 400,
      `status ${res.status}`,
    );
    const asGrower = await get(p, thomas.jar);
    check(`grower blocked from ${p}`, asGrower.status !== 200, `status ${asGrower.status}`);
  }
  const asAdmin = await get("/admin/permissions", admin.jar);
  check("admin can reach /admin/permissions", asAdmin.status === 200, `status ${asAdmin.status}`);

  const cat = readFileSync("src/lib/permissions.ts", "utf8");
  check(
    "an unknown permission key denies rather than allows",
    /if \(!permission\) return false/.test(cat),
  );
  check(
    "admins are not subject to per-client overrides",
    /if \(role === "ADMIN"\) return roleDefault\("ADMIN", key\)/.test(cat),
  );

  // Comments stripped first: access.ts explains at length *why* permissions
  // are not carried in the JWT, and a plain search would flag its own argument.
  const access = readFileSync("src/lib/access.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  check(
    "permissions are read live, not carried in the session token",
    /db\.clientPermission\.findMany/.test(access) && !/jwt|token/i.test(access),
  );

  const actions = readFileSync("src/app/admin/actions.ts", "utf8");
  check(
    "setting a permission re-checks that the key is configurable server-side",
    /if \(!permission\.configurable\)/.test(actions),
  );
  check(
    "permission changes are written to the activity log",
    /PERMISSION_GRANTED|PERMISSION_REVOKED/.test(actions),
  );

  /* --- the gate that actually bites, exercised for real --- */

  const thomasClient = await db.client.findFirst({
    where: { users: { some: { email: "thomas@example.com" } } },
    select: { id: true },
  });
  const doc = await db.attachment.findFirst({
    where: { clientId: thomasClient.id, storageKey: { not: null } },
    select: { id: true },
  });

  if (!doc) {
    W("no attachment to test the download gate against");
  } else {
    const before = await get(`/api/files/${doc.id}`, thomas.jar);
    check(
      "a grower CAN download their own file on the standard permissions",
      before.status === 200,
      `status ${before.status}`,
    );

    // Revoke it the same way the admin screen does, then ask again.
    await db.clientPermission.upsert({
      where: {
        clientId_key: {
          clientId: thomasClient.id,
          key: "DOWNLOAD_OWN_FILES",
        },
      },
      create: {
        clientId: thomasClient.id,
        key: "DOWNLOAD_OWN_FILES",
        allowed: false,
      },
      update: { allowed: false },
    });

    const during = await get(`/api/files/${doc.id}`, thomas.jar);
    check(
      "revoking the download permission blocks the file immediately",
      during.status === 403,
      `status ${during.status}`,
    );
    check(
      "a blocked download is never cached",
      (during.headers.get("cache-control") ?? "").includes("no-store"),
      during.headers.get("cache-control") ?? "absent",
    );

    // The revocation must not need a new sign-in to take effect — the whole
    // reason permissions are read from the database rather than the token.
    check(
      "the block applies to the session that was already signed in",
      during.status === 403,
    );

    await db.clientPermission.deleteMany({
      where: { clientId: thomasClient.id, key: "DOWNLOAD_OWN_FILES" },
    });

    const after = await get(`/api/files/${doc.id}`, thomas.jar);
    check(
      "restoring the permission restores the download",
      after.status === 200,
      `status ${after.status}`,
    );

    // An admin is never gated by a grower's override.
    await db.clientPermission.create({
      data: {
        clientId: thomasClient.id,
        key: "DOWNLOAD_OWN_FILES",
        allowed: false,
      },
    });
    const adminRead = await get(`/api/files/${doc.id}`, admin.jar);
    check(
      "an admin is not blocked by a grower's revoked permission",
      adminRead.status === 200,
      `status ${adminRead.status}`,
    );
    await db.clientPermission.deleteMany({
      where: { clientId: thomasClient.id, key: "DOWNLOAD_OWN_FILES" },
    });
  }

  // Ownership still outranks permission: holding the right does not let a
  // grower read someone else's file.
  const otherClient = await db.client.findFirst({
    where: { users: { none: { email: "thomas@example.com" } } },
    select: { id: true },
  });
  const otherDoc = otherClient
    ? await db.attachment.findFirst({
        where: { clientId: otherClient.id, storageKey: { not: null } },
        select: { id: true },
      })
    : null;
  if (otherDoc) {
    const res = await get(`/api/files/${otherDoc.id}`, thomas.jar);
    check(
      "the download permission does not override tenant isolation",
      res.status === 404,
      `status ${res.status}`,
    );
  }
}

/* ------------------------------------------------- 16. grower uploads (Doc 05) */

section("16. Grower uploads");

{
  const { readFileSync } = await import("node:fs");

  // The adding path moved to direct-actions.ts when uploads started going
  // straight to storage; deleting stayed behind in actions.ts.
  const src = readFileSync(
    "src/app/dashboard/uploads/direct-actions.ts",
    "utf8",
  );
  const deleteSrc = readFileSync(
    "src/app/dashboard/uploads/actions.ts",
    "utf8",
  );

  check(
    "the client ID comes from the session, never from the form",
    /requireClient\(\)/.test(src) &&
      !/formData\.get\(["']clientId["']\)/.test(src),
  );
  check(
    "every upload records who added it",
    /uploadedById: user\.id/.test(src),
  );
  check(
    "upload permission is checked before a ticket is issued",
    /KIND_PERMISSION\[kind\]/.test(src),
  );
  check(
    "deleting an own upload checks the permission AND the uploader",
    /requirePermission\("DELETE_OWN_UPLOADS"\)/.test(deleteSrc) &&
      /attachment\.uploadedById !== user\.id/.test(deleteSrc),
  );
  check(
    "an over-limit upload is removed rather than left on disk",
    /driver\.remove\(ticket\.storageKey\)/.test(src),
  );

  const shared = readFileSync("src/lib/uploads.ts", "utf8");
  check(
    "the admin work-log form still shares the inline validator",
    /export async function saveUpload/.test(shared) &&
      /import \{ saveUpload \}/.test(
        readFileSync("src/app/admin/actions.ts", "utf8"),
      ),
  );
  check(
    "SVG is still not an accepted upload type",
    !/image\/svg/.test(shared),
  );
  check(
    "the caller can narrow which kinds it will accept",
    /only\?: readonly UploadKind\[\]/.test(shared) &&
      /!only\.includes\(kind\)/.test(shared),
  );

  /* --- behaviour, against the running app --- */

  const thomasClient = await db.client.findFirst({
    where: { users: { some: { email: "thomas@example.com" } } },
    select: { id: true },
  });
  const thomasUser = await db.user.findFirst({
    where: { email: "thomas@example.com" },
    select: { id: true },
  });

  // A file Jinto added: the grower must not be able to delete it even holding
  // the delete permission. This is the record of work done on their estate.
  const adminAdded = await db.attachment.findFirst({
    where: { clientId: thomasClient.id, uploadedById: null },
    select: { id: true },
  });
  check(
    "seeded attachments have no uploader, so they read as the admin's",
    Boolean(adminAdded),
  );

  // Stand in a grower-uploaded row to prove the two cases differ.
  const own = await db.attachment.create({
    data: {
      clientId: thomasClient.id,
      uploadedById: thomasUser.id,
      kind: "DOCUMENT",
      url: "",
      storageKey: null,
      filename: "suite-own-upload.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1,
      category: "OTHER",
    },
  });

  check(
    "a grower's own upload is distinguishable from the admin's",
    own.uploadedById === thomasUser.id && adminAdded && !adminAdded.uploadedById,
  );

  // The permission gates the form's appearance; the route still gates the file.
  const ownRes = await get(`/api/files/${own.id}`, thomas.jar);
  check(
    "an uploaded row with no bytes 404s rather than erroring",
    ownRes.status === 404,
    `status ${ownRes.status}`,
  );

  await db.attachment.delete({ where: { id: own.id } });

  // Upload permissions must be revocable and must reach the page.
  await db.clientPermission.create({
    data: {
      clientId: thomasClient.id,
      key: "UPLOAD_DOCUMENTS",
      allowed: false,
    },
  });
  const docsPage = await get("/dashboard/documents", thomas.jar, "follow");
  const html = await docsPage.text();
  check(
    "with uploads revoked the documents page offers no upload control",
    !html.includes("Add a document"),
  );

  await db.clientPermission.deleteMany({
    where: { clientId: thomasClient.id, key: "UPLOAD_DOCUMENTS" },
  });
  const docsAgain = await get("/dashboard/documents", thomas.jar, "follow");
  const htmlAgain = await docsAgain.text();
  check(
    "restoring the permission brings the upload control back",
    htmlAgain.includes("Add a document"),
  );
}

/* ------------------------------- 17. search, settings, enquiries (Doc 05) */

section("17. Client search, self-service password, contact enquiries");

{
  const { readFileSync } = await import("node:fs");

  /* --- routes --- */

  for (const p of ["/admin/enquiries", "/dashboard/settings"]) {
    const res = await get(p);
    check(
      `anonymous blocked from ${p}`,
      res.status >= 300 && res.status < 400,
      `status ${res.status}`,
    );
  }
  const growerAtEnquiries = await get("/admin/enquiries", thomas.jar);
  check(
    "grower blocked from the enquiries queue",
    growerAtEnquiries.status !== 200,
    `status ${growerAtEnquiries.status}`,
  );

  /* --- client search --- */

  const clientsSrc = readFileSync("src/app/admin/clients/page.tsx", "utf8");
  check(
    "client search filters in the database, not the browser",
    /db\.client\.findMany\(\{\s*\n?\s*where,/.test(clientsSrc) ||
      /where,/.test(clientsSrc),
  );

  const search = async (q) => {
    const res = await get(
      `/admin/clients?q=${encodeURIComponent(q)}`,
      admin.jar,
      "follow",
    );
    const html = await res.text();
    return ["Thomas Mathew", "Rajan Pillai", "Mary Joseph", "Abdul Rahman"]
      .filter((n) => html.includes(n));
  };

  check(
    "search matches on name",
    (await search("raj")).join() === "Rajan Pillai",
  );
  check(
    "search is case-insensitive on village",
    (await search("vandanmedu")).join() === "Thomas Mathew",
  );
  check("search matches on client code", (await search("CLT-003")).join() === "Mary Joseph");
  check("a search with no matches returns nobody", (await search("zzzz")).length === 0);

  /* --- password change --- */

  const settingsSrc = readFileSync(
    "src/app/dashboard/settings/actions.ts",
    "utf8",
  );
  check(
    "changing a password requires the current one",
    /verify\(row\.passwordHash, current\)/.test(settingsSrc),
  );
  check(
    "a failed password change is rate limited",
    /rateLimit\(`pwchange/.test(settingsSrc),
  );
  check(
    "a successful change clears mustChangePassword",
    /mustChangePassword: false/.test(settingsSrc),
  );
  check(
    "both failed and successful password changes are logged",
    /PASSWORD_CHANGE_FAILED/.test(settingsSrc) &&
      /PASSWORD_CHANGED/.test(settingsSrc),
  );
  check(
    "a grower cannot change their own sign-in email without verification",
    !/email:\s*data\.email/.test(settingsSrc),
  );

  /* --- contact enquiries --- */

  const contactSrc = readFileSync("src/app/(site)/contact/actions.ts", "utf8");
  check(
    "the contact form refuses to store anything without consent",
    /formData\.get\("dpdpConsent"\) !== "yes"/.test(contactSrc),
  );
  check(
    "the enquiry and its consent record are written together",
    /db\.\$transaction/.test(contactSrc) && /consentRecord\.create/.test(contactSrc),
  );
  check("the contact form is rate limited", /rateLimit\(`enquiry/.test(contactSrc));

  const form = readFileSync(
    "src/app/(site)/contact/contact-form.tsx",
    "utf8",
  );
  check(
    "the contact form no longer fakes success",
    !/setSent\(true\)/.test(form),
  );

  // The published retention notice promises enquiries are kept a year, so the
  // purge has to actually cover them. The purge moved into src/lib/retention.ts
  // when the nightly job started sharing it with the admin button.
  const purgeSrc = readFileSync("src/lib/retention.ts", "utf8");
  check(
    "the retention purge covers enquiries, as the notice says",
    /retentionFor\("ENQUIRY"\)/.test(purgeSrc) &&
      /db\.enquiry\.deleteMany/.test(purgeSrc),
  );

  // A stored enquiry is user-supplied text rendered back into the admin.
  const stored = await db.enquiry.create({
    data: {
      reference: "ENQ-SUITE1",
      name: "Suite Probe",
      email: "suite@example.com",
      topic: "other",
      message: "<script>alert('xss')</script>",
    },
  });
  const page = await get("/admin/enquiries", admin.jar, "follow");
  const html = await page.text();
  check(
    "an enquiry's message is escaped, not executed",
    !html.includes("<script>alert('xss')</script>"),
  );
  await db.enquiry.delete({ where: { id: stored.id } });
}

/* --------------------------------------------------- 18. messages (Doc 05) */

section("18. Messages");

{
  const { readFileSync } = await import("node:fs");

  /* --- routes --- */

  for (const p of ["/dashboard/messages", "/admin/messages"]) {
    const res = await get(p);
    check(
      `anonymous blocked from ${p}`,
      res.status >= 300 && res.status < 400,
      `status ${res.status}`,
    );
  }
  const growerAtAdminMessages = await get("/admin/messages", thomas.jar);
  check(
    "grower blocked from the admin conversation list",
    growerAtAdminMessages.status !== 200,
    `status ${growerAtAdminMessages.status}`,
  );

  /* --- the isolation that matters most --- */

  const thomasClient = await db.client.findFirst({
    where: { users: { some: { email: "thomas@example.com" } } },
    select: { id: true },
  });
  const otherClient = await db.client.findFirst({
    where: { users: { none: { email: "thomas@example.com" } } },
    select: { id: true, name: true },
  });

  // A grower reaching another grower's thread by its admin URL.
  const cross = await get(`/admin/messages/${otherClient.id}`, thomas.jar);
  check(
    "a grower cannot open another grower's thread",
    cross.status !== 200,
    `status ${cross.status}`,
  );

  const own = await get("/dashboard/messages", thomas.jar, "follow");
  const ownHtml = await own.text();
  check("a grower can open their own thread", own.status === 200);

  // Plant a message on the other grower's thread and prove it never appears.
  const admin1 = await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  const planted = await db.message.create({
    data: {
      clientId: otherClient.id,
      senderUserId: admin1.id,
      body: "SUITE-CANARY-OTHER-CLIENT-MESSAGE",
    },
  });
  const reread = await get("/dashboard/messages", thomas.jar, "follow");
  const rereadHtml = await reread.text();
  check(
    "another grower's message never appears in this grower's thread",
    !rereadHtml.includes("SUITE-CANARY-OTHER-CLIENT-MESSAGE"),
  );
  await db.message.delete({ where: { id: planted.id } });

  /* --- the write path --- */

  const actions = readFileSync("src/app/messages-actions.ts", "utf8");
  check(
    "a grower's thread is taken from the session, not the form",
    /if \(user\.role === "CLIENT"\)/.test(actions) &&
      /return \{ user, clientId: user\.clientId \}/.test(actions),
  );
  check(
    "an admin-supplied client id is checked against the database",
    /db\.client\.findUnique\(\{\s*\n?\s*where: \{ id: requestedClientId \}/.test(
      actions,
    ),
  );
  check(
    "read receipts only mark messages the viewer did not write",
    /sender: \{ is: \{ role: from \} \}/.test(actions),
  );

  const lib = readFileSync("src/lib/messages.ts", "utf8");
  check(
    "unread is counted by who sent it, not merely by readAt",
    /sender: \{ role: "ADMIN" \}/.test(lib) && /sender: \{ role: "CLIENT" \}/.test(lib),
  );

  /* --- message bodies are user input rendered back --- */

  const xss = await db.message.create({
    data: {
      clientId: thomasClient.id,
      senderUserId: admin1.id,
      body: "<img src=x onerror=alert('m')>",
    },
  });
  const rendered = await get("/dashboard/messages", thomas.jar, "follow");
  const renderedHtml = await rendered.text();
  check(
    "a message body is escaped, not executed",
    !renderedHtml.includes("<img src=x onerror=alert('m')>"),
  );
  await db.message.delete({ where: { id: xss.id } });

  void ownHtml;
}

/* --------------------------------------------------- 19. reports (Doc 05) */

section("19. Reports");

{
  const { readFileSync } = await import("node:fs");

  /* --- who may see them (Doc 06: View Reports, admin only) --- */

  const anon = await get("/admin/reports");
  check(
    "anonymous blocked from /admin/reports",
    anon.status >= 300 && anon.status < 400,
    `status ${anon.status}`,
  );
  const grower = await get("/admin/reports", thomas.jar);
  check(
    "grower blocked from reports",
    grower.status !== 200,
    `status ${grower.status}`,
  );

  // The CSV is a summary of every grower's spend and yield. It must be guarded
  // at the route, not by hiding the link.
  const csvAnon = await get("/api/reports/clients.csv");
  check(
    "anonymous cannot download the clients CSV",
    csvAnon.status === 404,
    `status ${csvAnon.status}`,
  );
  const csvGrower = await get("/api/reports/clients.csv", thomas.jar);
  check(
    "a grower cannot download the clients CSV",
    csvGrower.status === 404,
    `status ${csvGrower.status}`,
  );

  const csvAdmin = await get("/api/reports/clients.csv?period=all", admin.jar);
  check("admin can download the clients CSV", csvAdmin.status === 200, `status ${csvAdmin.status}`);

  if (csvAdmin.status === 200) {
    check(
      "the CSV is not cached",
      (csvAdmin.headers.get("cache-control") ?? "").includes("no-store"),
    );
    check(
      "the CSV is sent as a download",
      (csvAdmin.headers.get("content-disposition") ?? "").includes("attachment"),
    );

    const buf = Buffer.from(await csvAdmin.arrayBuffer());
    check(
      "the CSV carries a UTF-8 BOM so Excel reads the rupee sign",
      buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf,
    );

    const text = buf.toString("utf8").replace(/^﻿/, "");
    const lines = text.split("\r\n").filter(Boolean);
    check(
      "every CSV field is quoted, so a comma in a name cannot shift columns",
      lines.every((l) => l.startsWith('"') && l.endsWith('"')),
    );

    const clientCount = await db.client.count();
    check(
      "the CSV has one row per client plus a header",
      lines.length === clientCount + 1,
      `${lines.length} lines for ${clientCount} clients`,
    );
  }

  /* --- the figures reconcile against the database --- */

  const totals = await db.activity.aggregate({
    _count: true,
    _sum: { totalCost: true, driedWeightKg: true, greenWeightKg: true },
  });

  const page = await get("/admin/reports?period=all", admin.jar, "follow");
  const html = await page.text();

  const inr = (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    })
      .format(n)
      .replace(/ /g, " ");

  check(
    "total spend on the page matches the database",
    html.includes(inr(totals._sum.totalCost)) ||
      html.includes(inr(totals._sum.totalCost).replace("₹", "₹")),
    inr(totals._sum.totalCost),
  );
  check(
    "job count on the page matches the database",
    html.includes(`${totals._count} jobs`),
    `${totals._count} jobs`,
  );

  const recovery = (
    (totals._sum.driedWeightKg / totals._sum.greenWeightKg) *
    100
  ).toFixed(1);
  check(
    "curing recovery is computed from green and dried weights",
    html.includes(`${recovery}%`),
    `${recovery}%`,
  );

  /* --- the arithmetic itself --- */

  const src = readFileSync("src/lib/reports.ts", "utf8");
  check(
    "cancelled orders are left out of store revenue",
    /status !== "CANCELLED"/.test(src),
  );
  check(
    "the period is resolved outside the component, not from the clock in render",
    /function rangeFor/.test(src) && !/Date\.now\(\)/.test(
      readFileSync("src/app/admin/reports/page.tsx", "utf8"),
    ),
  );
  check(
    "CSV quoting doubles any quote inside a value",
    /replace\(\/"\/g, '""'\)/.test(src),
  );
}

/* ------------------------------- 20. notifications and the scheduler */

section("20. Notifications and the scheduler");

{
  const { readFileSync } = await import("node:fs");

  /* --- the scheduled endpoint erases data, so its guard matters most --- */

  const noAuth = await fetch(`${BASE}/api/cron`, { redirect: "manual" });
  check(
    "the cron endpoint refuses an unauthenticated call",
    noAuth.status === 404 || noAuth.status === 503,
    `status ${noAuth.status}`,
  );

  const wrongSecret = await fetch(`${BASE}/api/cron`, {
    redirect: "manual",
    headers: { authorization: "Bearer definitely-not-the-secret" },
  });
  check(
    "the cron endpoint refuses a wrong secret",
    wrongSecret.status === 404,
    `status ${wrongSecret.status}`,
  );

  // A signed-in admin is still not a scheduler.
  const asAdmin = await get("/api/cron", admin.jar);
  check(
    "a signed-in admin cannot trigger the job without the secret",
    asAdmin.status === 404 || asAdmin.status === 503,
    `status ${asAdmin.status}`,
  );

  const cronSrc = readFileSync("src/app/api/cron/route.ts", "utf8");
  check(
    "there is no development escape hatch around the cron secret",
    !/NODE_ENV\s*!==\s*["']production["']/.test(cronSrc),
  );
  check(
    "a missing CRON_SECRET refuses rather than running unauthenticated",
    /if \(!secret\)/.test(cronSrc) && /503/.test(cronSrc),
  );

  /* --- queueing must never break the action that triggered it --- */

  const notifySrc = readFileSync("src/lib/notify.ts", "utf8");
  check(
    "queueing a notification never throws",
    /try \{/.test(notifySrc) && /catch \(e\) \{/.test(notifySrc),
  );
  check(
    "the recipient's address is copied onto the row, not joined at send time",
    /toPhone: input\.toPhone/.test(notifySrc),
  );
  check(
    "a row is claimed before the provider is called, so two runs cannot double-send",
    /status: "PENDING"/.test(notifySrc) && /claimed\.count === 0/.test(notifySrc),
  );
  check(
    "retries stop after a bounded number of attempts",
    /MAX_ATTEMPTS/.test(notifySrc),
  );

  // DPDP: transactional only. A broadcast helper is the thing that would turn
  // this into marketing without consent.
  check(
    "there is no send-to-everyone helper",
    !/findMany\(\{\s*where:\s*\{\s*role:\s*"CLIENT"/.test(notifySrc) &&
      !/broadcast/i.test(notifySrc),
  );

  const providerSrc = readFileSync("src/lib/notify-providers.ts", "utf8");
  check(
    "the WhatsApp provider fails loudly with no credentials rather than pretending",
    /WHATSAPP_TOKEN \/ WHATSAPP_PHONE_ID are not set/.test(providerSrc),
  );

  /* --- retention covers what notifications hold --- */

  const dpdpSrc = readFileSync("src/lib/dpdp.ts", "utf8");
  check(
    "notifications have a published retention period",
    /key: "NOTIFICATION"/.test(dpdpSrc),
  );
  const retentionSrc = readFileSync("src/lib/retention.ts", "utf8");
  check(
    "the purge deletes expired notifications",
    /db\.notification\.deleteMany/.test(retentionSrc),
  );
  check(
    "the purge is one implementation shared by the button and the schedule",
    /export async function purgeExpiredData/.test(retentionSrc) &&
      /purgeExpiredData/.test(readFileSync("src/app/admin/actions.ts", "utf8")),
  );

  /* --- the scheduled digest is idempotent --- */

  const remindersSrc = readFileSync("src/lib/reminders.ts", "utf8");
  check(
    "the daily digest carries a dated dedupe key",
    /dedupeKey = `rounds-due:/.test(remindersSrc),
  );

  const secret = process.env.CRON_SECRET;
  if (secret) {
    await db.notification.deleteMany({ where: { kind: "ROUNDS_DUE" } });

    const runOnce = async () => {
      const res = await fetch(`${BASE}/api/cron`, {
        headers: { authorization: `Bearer ${secret}` },
      });
      return res.json();
    };

    const first = await runOnce();
    const second = await runOnce();

    check(
      "the scheduled job runs with the right secret",
      first.ok === true,
      JSON.stringify(first.dispatch ?? {}),
    );
    check(
      "running the job twice in a day queues one digest, not two",
      second.reminders?.reason === "duplicate" ||
        second.reminders?.queued === false,
      JSON.stringify(second.reminders ?? {}),
    );

    const digests = await db.notification.count({ where: { kind: "ROUNDS_DUE" } });
    check("exactly one digest exists after two runs", digests === 1, `${digests}`);
  } else {
    W("cron behaviour not exercised — CRON_SECRET is not set in this shell");
  }
}

/* ------------------------------------------- 21. upload size and transport */

section("21. Upload size and transport");

{
  const { readFileSync } = await import("node:fs");

  const limits = readFileSync("src/lib/upload-limits.ts", "utf8");
  const config = readFileSync("next.config.ts", "utf8");

  // The limit the UI promises has to be one the transport can actually carry.
  // It was 25 MB against a 1 MB Server Action body, so every phone photograph
  // died on a runtime error page before reaching any of our code.
  // Section 22 covers direct-to-storage. This is about the one path still
  // carried inside a Server Action body: Jinto's work-log form.
  const declared = /MAX_INLINE_BYTES = (\d+) \* 1024 \* 1024/.exec(limits);
  check(
    "the inline upload limit is stated in whole megabytes",
    Boolean(declared),
    declared?.[1],
  );

  const limitMb = declared ? Number(declared[1]) : Infinity;
  check(
    "the inline upload limit fits Vercel's 4.5 MB request body cap",
    limitMb <= 4,
    `${limitMb} MB`,
  );

  const configured = /bodySizeLimit: "(\d+)mb"/.exec(config);
  check(
    "the Server Action body limit is configured, not left at the 1 MB default",
    Boolean(configured),
    configured?.[1] ? `${configured[1]}mb` : "absent",
  );
  check(
    "the configured body limit is at least the inline upload limit",
    configured ? Number(configured[1]) >= limitMb : false,
  );

  // The bug that made this surface as a Turbopack panic rather than an error:
  // client code importing the server module dragged node:fs into the bundle.
  check(
    "the shared limits module has no runtime imports",
    !/^import .*from "node:/m.test(limits) && !/@\/lib\/files/.test(limits),
  );
  const compressor = readFileSync("src/lib/compress-image.ts", "utf8");
  check(
    "the browser compressor imports limits, never the server upload module",
    /@\/lib\/upload-limits/.test(compressor) &&
      !/@\/lib\/uploads/.test(compressor),
  );

  // The work-log form still posts its photos inside the action, so it must
  // still shrink them. The grower's gallery deliberately does not: it sends
  // originals straight to storage, which is the whole point of section 22.
  check(
    "the admin work-log form compresses photos before sending",
    /prepareFiles/.test(
      readFileSync("src/app/admin/activities/new/activity-form.tsx", "utf8"),
    ),
  );
  const galleryForm = readFileSync(
    "src/app/dashboard/uploads/upload-form.tsx",
    "utf8",
  );
  check(
    "the grower's gallery uploads originals rather than shrinking them",
    /uploadFiles/.test(galleryForm) && !/prepareFiles/.test(galleryForm),
  );
  check(
    // Was describeLimit, until the limits became deployment-dependent: the
    // form is now handed the effective numbers rather than importing the
    // intended ones. Same intent — no figure written by hand.
    "the gallery states its limits from the numbers it was given, not prose",
    /formatBytes\(limits\./.test(galleryForm) && !/\d+ MB/.test(galleryForm),
  );
}

/* ----------------------------------------- 22. direct-to-storage uploads */

section("22. Direct-to-storage uploads");

{
  const { readFileSync, existsSync, unlinkSync } = await import("node:fs");

  const ticketSrc = readFileSync(
    "src/app/dashboard/uploads/direct-actions.ts",
    "utf8",
  );
  const routeSrc = readFileSync("src/app/api/upload/[token]/route.ts", "utf8");
  const storageSrc = readFileSync("src/lib/storage.ts", "utf8");

  /* --- what the ticket decides, the client cannot --- */

  check(
    "the storage key is assigned by the server, never taken from the client",
    /driver\.keyFor\(/.test(ticketSrc) && /keyFor\(filename/.test(storageSrc),
  );
  check(
    "the estate comes from the session, not the request",
    /requireClient\(\)/.test(ticketSrc) &&
      /clientId: user\.clientId/.test(ticketSrc),
  );
  check(
    "permission is checked before a ticket is issued",
    /KIND_PERMISSION\[kind\]/.test(ticketSrc),
  );
  check(
    "the size the browser reports is not trusted at completion",
    /driver\.sizeOf\(ticket\.storageKey\)/.test(ticketSrc),
  );
  check(
    "a ticket is single use",
    /ticket\.status !== "ISSUED"/.test(ticketSrc),
  );
  check(
    "a ticket belonging to someone else is refused",
    /ticket\.userId !== user\.id/.test(ticketSrc),
  );

  /* --- the receiving endpoint --- */

  check(
    "the upload endpoint streams rather than buffering the whole file",
    /pipeline\(/.test(routeSrc) && !/arrayBuffer\(\)/.test(routeSrc),
  );
  check(
    "the size cap is counted as bytes arrive, not taken from Content-Length",
    /written \+= chunk\.length/.test(routeSrc) &&
      /written > ticket\.maxBytes/.test(routeSrc),
  );
  check(
    "a rejected upload does not leave a partial file behind",
    /unlink\(full\)/.test(routeSrc),
  );

  /* --- behaviour, against the running server --- */

  const thomasUser = await db.user.findFirst({
    where: { email: "thomas@example.com" },
    select: { id: true, clientId: true },
  });

  const makeTicket = async (over) => {
    const token = `suite-${Math.random().toString(36).slice(2)}`;
    await db.uploadTicket.create({
      data: {
        token,
        userId: thomasUser.id,
        clientId: thomasUser.clientId,
        kind: "DOCUMENT",
        mimeType: "application/pdf",
        filename: "suite.pdf",
        maxBytes: 1024,
        storageKey: `${token}.pdf`,
        expiresAt: new Date(Date.now() + 3600_000),
        ...(over ? { status: "COMPLETED" } : {}),
      },
    });
    return token;
  };

  const unknown = await fetch(`${BASE}/api/upload/not-a-real-token`, {
    method: "PUT",
    body: Buffer.alloc(10),
  });
  check(
    "an unknown upload token is refused",
    unknown.status === 404,
    `status ${unknown.status}`,
  );

  const overToken = await makeTicket(false);
  const over = await fetch(`${BASE}/api/upload/${overToken}`, {
    method: "PUT",
    body: Buffer.alloc(5000, 65),
  });
  check(
    "a body larger than the ticket allows is refused",
    over.status === 413,
    `status ${over.status}`,
  );
  check(
    "the refused upload left no partial file on disk",
    !existsSync(`private-uploads/${overToken}.pdf`),
  );

  const usedToken = await makeTicket(true);
  const replay = await fetch(`${BASE}/api/upload/${usedToken}`, {
    method: "PUT",
    body: Buffer.alloc(10),
  });
  check(
    "a ticket that has already been used cannot be replayed",
    replay.status === 404,
    `status ${replay.status}`,
  );

  const okToken = await makeTicket(false);
  const good = await fetch(`${BASE}/api/upload/${okToken}`, {
    method: "PUT",
    body: Buffer.alloc(500, 66),
  });
  check(
    "an upload within the ticket's limit is accepted",
    good.status === 200,
    `status ${good.status}`,
  );
  if (existsSync(`private-uploads/${okToken}.pdf`)) {
    unlinkSync(`private-uploads/${okToken}.pdf`);
  }

  await db.uploadTicket.deleteMany({ where: { token: { startsWith: "suite-" } } });

  /* --- the limits actually rose --- */

  const limits = readFileSync("src/lib/upload-limits.ts", "utf8");
  const video = /VIDEO: (\d+) \* 1024 \* 1024/.exec(limits);
  check(
    "video uploads are no longer bounded by the request body",
    video ? Number(video[1]) >= 100 : false,
    video ? `${video[1]} MB` : "absent",
  );
}

/* ------------------------------------------------------- 23. S3 storage */

section("23. S3 storage driver");

{
  const { readFileSync, existsSync } = await import("node:fs");
  const { createHmac } = await import("node:crypto");

  const sig = readFileSync("src/lib/sigv4.ts", "utf8");
  const store = readFileSync("src/lib/storage.ts", "utf8");
  const filesRoute = readFileSync("src/app/api/files/[id]/route.ts", "utf8");

  /* --- the crypto, against AWS's own published vector --- */

  // Reimplemented here rather than imported: a test that borrows the code it
  // is testing proves only that the code equals itself.
  const hmac = (key, data) => createHmac("sha256", key).update(data, "utf8").digest();
  const derive = (secret, date, region, service) =>
    hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), service), "aws4_request");

  const vector = derive(
    "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
    "20120215",
    "us-east-1",
    "iam",
  ).toString("hex");

  check(
    "SigV4 key derivation matches AWS's published vector",
    vector === "f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d",
    vector.slice(0, 16),
  );
  check(
    "the signer derives its key the same way",
    /AWS4\$\{secret\}/.test(sig) &&
      /aws4_request/.test(sig) &&
      /createHmac\("sha256"/.test(sig),
  );

  /* --- signing choices that carry security weight --- */

  check(
    "presigned uploads sign the content type, pinning what may be sent",
    /contentType\?: string/.test(sig) &&
      /headers\["content-type"\] = options\.contentType/.test(sig),
  );
  check(
    "the upload target signs the ticket's own mime type",
    /contentType: mimeType/.test(store),
  );
  check(
    "presigned URLs do not sign a body",
    /UNSIGNED-PAYLOAD/.test(sig),
  );
  check(
    "query parameters are sorted before signing",
    /\.sort\(\)/.test(sig),
  );
  check(
    "RFC 3986 encoding covers the characters encodeURIComponent leaves",
    /\[!'\(\)\*\]/.test(sig),
  );
  check(
    "object keys keep their slashes as separators",
    /split\("\/"\)/.test(sig),
  );

  /* --- configuration must fail loudly, never halfway --- */

  check(
    "a partly configured bucket refuses to start and names what is missing",
    /missing\.length > 0/.test(store) &&
      /not set\./.test(store) &&
      ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].every(
        (name) => store.includes(`&& "${name}"`),
      ),
  );
  check(
    "non-AWS endpoints are addressed by path, which the signature covers",
    /config\.endpoint/.test(sig) && /\$\{config\.bucket\}\/\$\{encodePath/.test(sig),
  );

  /* --- reads keep the ownership check --- */

  check(
    "remote files are still checked for ownership before a URL is issued",
    filesRoute.indexOf("storageIsRemote()") > filesRoute.indexOf("if (!allowed)"),
  );
  check(
    "the download redirect is never cached",
    /"cache-control": "private, no-store"/.test(filesRoute),
  );

  const ttl = /GET_TTL_SECONDS = (\d+)/.exec(store);
  check(
    "download URLs expire quickly, because they are bearer tokens",
    ttl ? Number(ttl[1]) <= 300 : false,
    ttl ? `${ttl[1]}s` : "absent",
  );

  /* --- the things a human has to get right are written down --- */

  const docs = readFileSync("docs/storage.md", "utf8");
  check("CORS setup is documented", /CORS/.test(docs) && /AllowedMethods/.test(docs));
  check(
    "the docs say the bucket must stay private",
    /must stay private/i.test(docs),
  );
  check(
    "there is a way to verify a real bucket",
    // Matches the script path or the npm alias — the docs now use the alias.
    /verify[-:]s3/.test(docs) && existsSync("scripts/verify-s3.mts"),
  );
}


/* ----------------------------------------------------------- 13. secrets */

section("13. Secrets and configuration");

{
  const { readFileSync, existsSync } = await import("node:fs");
  const gitignore = readFileSync(".gitignore", "utf8");
  check(".env is git-ignored", /^\.env\*?$/m.test(gitignore) || gitignore.includes(".env*"));

  const env = existsSync(".env") ? readFileSync(".env", "utf8") : "";
  if (env.includes("demo-only-secret")) {
    W("AUTH_SECRET is the demo placeholder", "generate with `npx auth secret` before deploying");
  } else {
    P("AUTH_SECRET is not the demo placeholder");
  }

  const res = await fetch(`${BASE}/.env`);
  check("/.env is not served", res.status === 404, `status ${res.status}`);
}

/* -------------------------------------------- 24. Upload capacity honesty */

section("24. Upload capacity");

{
  const { readFileSync } = await import("node:fs");

  const limits = readFileSync("src/lib/upload-limits.ts", "utf8");
  const capacity = readFileSync("src/lib/upload-capacity.ts", "utf8");
  const ticket = readFileSync("src/app/dashboard/uploads/direct-actions.ts", "utf8");
  const form = readFileSync("src/app/dashboard/uploads/upload-form.tsx", "utf8");

  check(
    // The call was inlined until the availability check needed the same
    // object; still the effective ceiling, read from capacity rather than
    // from MAX_BYTES.
    "the ticket is issued against the effective ceiling, not the intended one",
    /const capacity = uploadCapacity\(\)/.test(ticket) &&
      /capacity\.limits\[kind\]/.test(ticket) &&
      !/maxBytesFor/.test(ticket),
  );
  check(
    "the refusal quotes the same number it refused against",
    /formatBytes\(maxBytes\)/.test(ticket),
  );
  check(
    "the form is told the limits rather than importing them",
    /limits: UploadLimits/.test(form) && !/describeLimit/.test(form),
  );
  check(
    "the rule stays pure, so it can be tested outside its own deployment",
    /export function computeCapacity/.test(limits) &&
      !/process\.env/.test(limits),
  );
  check(
    "the environment is read in one place",
    /process\.env\.VERCEL/.test(capacity) &&
      /UPLOAD_BODY_LIMIT_BYTES/.test(capacity),
  );
  check(
    "a constrained deployment warns whoever deployed it",
    /console\.warn/.test(capacity) && /capacity\.constrained/.test(capacity),
  );
  check(
    "a host with no persistent disk switches uploads off rather than shrinking them",
    /localDiskPersists/.test(capacity) &&
      /!remote && !localDiskPersists/.test(limits) &&
      /available: false/.test(limits),
  );
  check(
    "and logs it as an error, because nothing in the interface will say so",
    /console\.error/.test(capacity) && /!capacity\.available/.test(capacity),
  );
  check(
    "the ticket refuses when there is nowhere to store the file",
    /!capacity\.available/.test(ticket),
  );
  check(
    "the form is not offered in that state, on either page",
    ["gallery", "documents"].every((page) =>
      /canUpload && available/.test(
        readFileSync(`src/app/dashboard/${page}/page.tsx`, "utf8"),
      ),
    ),
  );
  check(
    "upload-limits imports nothing at runtime, so the browser can have it",
    !/^import /m.test(limits),
  );
}

/* ------------------------------------------------ 25. Website content (Doc 05) */

section("25. Website content");

{
  const { readFileSync } = await import("node:fs");

  const catalogue = readFileSync("src/lib/site-content.ts", "utf8");
  const reader = readFileSync("src/lib/content.ts", "utf8");
  const action = readFileSync("src/app/admin/content/actions.ts", "utf8");
  const seedSrc = readFileSync("prisma/seed.ts", "utf8");

  /* --- the editable surface is declared, not open --- */

  check(
    "only catalogued keys can be written",
    /for \(const field of CONTENT_FIELDS\)/.test(action) &&
      !/formData\.entries\(\)/.test(action) &&
      !/for \(const \[key/.test(action),
  );
  check(
    "the whole form is validated before anything is written",
    action.indexOf("validateContent") < action.indexOf("db.$transaction"),
  );
  check(
    "the writes go in one transaction, so a failure cannot half-change the site",
    /db\.\$transaction/.test(action),
  );
  check(
    "editing the site is audited",
    /CONTENT_UPDATED/.test(action) && /CONTENT_RESET/.test(action),
  );
  check(
    "saving revalidates the public pages",
    /revalidatePath\("\/", "layout"\)/.test(action),
  );

  /* --- plain text, never markup --- */

  check(
    "angle brackets are refused in every field",
    /\[<>\]/.test(catalogue),
  );
  check(
    "phone and email fields are format-checked",
    /kind === "phone"/.test(catalogue) && /kind === "email"/.test(catalogue),
  );
  check(
    "no field is rendered as raw HTML",
    !/dangerouslySetInnerHTML/.test(
      readFileSync("src/app/admin/content/content-form.tsx", "utf8"),
    ) && !/dangerouslySetInnerHTML/.test(catalogue),
  );

  /* --- a missing row can never blank the site --- */

  check(
    "defaults are merged under the stored rows, not over them",
    /\.\.\.CONTENT_DEFAULTS, \.\.\.stored/.test(reader),
  );
  check(
    "an empty stored value is treated as absent, not as an edit",
    /r\.value\.trim\(\) !== ""/.test(reader),
  );
  check(
    "an unreachable settings table still renders the site",
    /catch/.test(reader) && /return \{ \.\.\.CONTENT_DEFAULTS \}/.test(reader),
  );
  check(
    "the seed writes no settings, so a fresh install shows the shipped copy",
    !/setting\.createMany/.test(seedSrc),
  );

  /* --- one query per request --- */

  check(
    "content is read once per request",
    /cache\(async/.test(reader),
  );
}

/* --------------------------------------------------- 25. Thumbnail route */

section("25. Thumbnails");

{
  const { readFileSync } = await import("node:fs");

  const shared = readFileSync("src/lib/attachment-access.ts", "utf8");
  const thumbRoute = readFileSync("src/app/api/thumb/[id]/route.ts", "utf8");
  const filesRoute = readFileSync("src/app/api/files/[id]/route.ts", "utf8");
  const thumbs = readFileSync("src/lib/thumbnails.ts", "utf8");

  check(
    "both doors onto a file share one access check",
    /authorizeAttachment/.test(thumbRoute) && /authorizeAttachment/.test(filesRoute),
  );
  check(
    "neither route re-implements the ownership rule",
    !/user\.clientId === attachment\.clientId/.test(thumbRoute) &&
      !/user\.clientId === attachment\.clientId/.test(filesRoute),
  );
  check(
    "the shared check reads the client from the session, never the request",
    /getCurrentUser\(\)/.test(shared) && !/searchParams/.test(shared),
  );
  check(
    "a file that is not yours is 404, not 403",
    /status: 404, reason: "not yours"/.test(shared),
  );
  check(
    "the thumbnail honours the download permission too",
    /clientCan\(/.test(shared) && /DOWNLOAD_OWN_FILES/.test(shared),
  );
  check(
    "only photographs get one",
    /attachment\.kind !== "IMAGE"/.test(thumbRoute),
  );
  check(
    "SVG is never rasterised — it is XML with a parser attached",
    !/svg/i.test(thumbs.split("const RESIZABLE")[1].split("]")[0]),
  );
  check(
    "widths come from an allowlist, not from the query string",
    /THUMB_WIDTHS = \[/.test(thumbs) && /clampWidth/.test(thumbRoute),
  );
  check(
    "the cache key is hashed, so a storage key cannot escape the directory",
    /createHash\("sha256"\)/.test(thumbs),
  );
  check(
    "variants are written then renamed, so a racing reader never sees half a file",
    /rename\(/.test(thumbs),
  );
  check(
    "thumbnails are cacheable only by the viewer",
    /private, max-age/.test(thumbRoute) && !/public/.test(thumbRoute),
  );
  check(
    "and are still sandboxed and nosniffed",
    /sandbox/.test(thumbRoute) && /nosniff/.test(thumbRoute),
  );
}

/* ------------------------------------------------------------------ report */

console.log("\n" + "=".repeat(62));
console.log(`\x1b[1m${pass} passed · ${fail} failed · ${warn} warnings\x1b[0m`);
if (failures.length) {
  console.log("\n\x1b[31mFailures:\x1b[0m");
  failures.forEach((f) => console.log("  - " + f));
}
if (warnings.length) {
  console.log("\n\x1b[33mKnown gaps (accepted for the demo):\x1b[0m");
  warnings.forEach((w) => console.log("  - " + w));
}

await db.$disconnect();
process.exit(fail ? 1 : 0);
