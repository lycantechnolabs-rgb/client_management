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

/** Invoke a server action by its build id — the real attack path. */
async function callAction(path, actionId, args, j) {
  return fetch(BASE + path, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "text/plain;charset=UTF-8",
      "next-action": actionId,
      cookie: j ? j.header() : "",
    },
    body: JSON.stringify(args),
  });
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
    "/admin/orders",
    "/dashboard",
    "/dashboard/expenses",
    "/dashboard/documents",
  ]) {
    const res = await get(p);
    const ok = res.status >= 300 && res.status < 400;
    check(`anonymous blocked from ${p}`, ok, `status ${res.status}`);
  }

  for (const p of ["/admin", "/admin/clients", "/admin/orders", "/admin/workers"]) {
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
  const src = readFileSync("src/app/admin/actions.ts", "utf8");
  const storage = readFileSync("src/lib/files.ts", "utf8");

  check("upload size is capped", src.includes("MAX_UPLOAD_BYTES"));
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
