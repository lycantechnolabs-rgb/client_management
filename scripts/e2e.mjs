/**
 * End-to-end check against the running dev server.
 * Exercises auth, role routing, cross-client isolation and the store.
 * Run with the dev server up:  node scripts/e2e.mjs
 */
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE ?? "http://localhost:3000";
const db = new PrismaClient();

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Minimal cookie jar so we can hold a session across requests. */
function makeJar() {
  const jar = new Map();
  return {
    header: () =>
      [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb: (res) => {
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(";");
        const i = pair.indexOf("=");
        jar.set(pair.slice(0, i), pair.slice(i + 1));
      }
    },
  };
}

async function get(path, jar, { redirect = "manual" } = {}) {
  const res = await fetch(BASE + path, {
    redirect,
    headers: jar ? { cookie: jar.header() } : {},
  });
  jar?.absorb(res);
  return res;
}

/** Auth.js v5 credentials sign-in. */
async function login(email, password) {
  const jar = makeJar();
  const csrfRes = await get("/api/auth/csrf", jar);
  const { csrfToken } = await csrfRes.json();

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: jar.header(),
    },
    body: new URLSearchParams({ csrfToken, email, password }),
  });
  jar.absorb(res);

  const sessionRes = await get("/api/auth/session", jar);
  const session = await sessionRes.json();
  return { jar, session, status: res.status };
}

console.log("\n=== 1. Public routes ===");
for (const p of [
  "/",
  "/services",
  "/how-it-works",
  "/store",
  "/about",
  "/contact",
  "/login",
  "/cart",
  "/orders/lookup",
]) {
  const res = await get(p);
  check(`GET ${p}`, res.status === 200, `got ${res.status}`);
}

console.log("\n=== 2. Protected routes reject anonymous visitors ===");
for (const p of ["/admin", "/dashboard", "/admin/clients", "/dashboard/expenses"]) {
  const res = await get(p);
  const redirected = res.status >= 300 && res.status < 400;
  const loc = res.headers.get("location") ?? "";
  check(
    `GET ${p} redirects to login`,
    redirected && loc.includes("login"),
    `status ${res.status}, location ${loc || "(none)"}`,
  );
}

console.log("\n=== 3. Admin login ===");
const admin = await login("jinto@aela.co.in", "Admin@123");
check("admin session created", admin.session?.user?.role === "ADMIN",
  JSON.stringify(admin.session));
{
  const res = await get("/admin", admin.jar);
  check("admin can open /admin", res.status === 200, `got ${res.status}`);
}
{
  const res = await get("/admin/activities/new", admin.jar);
  check("admin can open activity form", res.status === 200, `got ${res.status}`);
}

console.log("\n=== 4. Client login ===");
const clientUser = await db.user.findFirst({
  where: { role: "CLIENT" },
  include: { client: true },
});
const client = await login(clientUser.email, "Client@123");
check("client session created", client.session?.user?.role === "CLIENT",
  JSON.stringify(client.session));
{
  const res = await get("/dashboard", client.jar);
  check("client can open /dashboard", res.status === 200, `got ${res.status}`);
}

console.log("\n=== 5. Role separation ===");
{
  const res = await get("/admin", client.jar);
  const blocked = res.status !== 200;
  check("client CANNOT open /admin", blocked, `got ${res.status}`);
}
{
  const res = await get("/admin/clients", client.jar);
  check("client CANNOT open /admin/clients", res.status !== 200, `got ${res.status}`);
}

console.log("\n=== 6. Cross-client isolation (IDOR) ===");
const otherClient = await db.client.findFirst({
  where: { id: { not: clientUser.clientId } },
});
const otherActivity = await db.activity.findFirst({
  where: { clientId: otherClient.id },
});
console.log(
  `  logged in as ${clientUser.client.name}; probing ${otherClient.name}'s activity`,
);
{
  const res = await get(`/dashboard/activities/${otherActivity.id}`, client.jar);
  const body = res.status === 200 ? await res.text() : "";
  const leaked = body.includes(otherActivity.title);
  check(
    "client CANNOT read another client's activity",
    res.status === 404 || res.status >= 300 || !leaked,
    `status ${res.status}, leaked=${leaked}`,
  );
}
{
  const ownActivity = await db.activity.findFirst({
    where: { clientId: clientUser.clientId },
  });
  const res = await get(`/dashboard/activities/${ownActivity.id}`, client.jar);
  const body = await res.text();
  check(
    "client CAN read their own activity",
    res.status === 200 && body.includes(ownActivity.title),
    `status ${res.status}`,
  );
}

console.log("\n=== 7. Store ===");
const product = await db.product.findFirst({
  where: { isActive: true },
  include: { variants: true },
});
{
  const res = await get(`/store/${product.slug}`);
  const body = await res.text();
  check(
    `product page renders "${product.name}"`,
    res.status === 200 && body.includes(product.name),
    `got ${res.status}`,
  );
}
{
  const res = await get("/products", null);
  check(
    "/products redirects to /store",
    res.status === 308 && res.headers.get("location")?.endsWith("/store"),
    `status ${res.status}, location ${res.headers.get("location")}`,
  );
}

console.log("\n=== 8. Data integrity ===");
const counts = {
  clients: await db.client.count(),
  plots: await db.plot.count(),
  activities: await db.activity.count(),
  materials: await db.material.count(),
  workers: await db.worker.count(),
  attachments: await db.attachment.count(),
  products: await db.product.count(),
};
console.log("  " + JSON.stringify(counts));
check("seed data present", Object.values(counts).every((n) => n > 0));

// Every attachment must resolve to a client that exists, so ownership checks
// can never fall through.
const clientIds = new Set((await db.client.findMany({ select: { id: true } })).map((c) => c.id));
const attachments = await db.attachment.findMany({ select: { clientId: true } });
const dangling = attachments.filter((a) => !clientIds.has(a.clientId)).length;
check("every attachment resolves to a real client", dangling === 0, `${dangling} dangling`);

console.log(`\n${"=".repeat(50)}`);
console.log(`${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log("  - " + f));
}
await db.$disconnect();
process.exit(fail ? 1 : 0);
