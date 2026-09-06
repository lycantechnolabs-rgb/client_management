# Project Status — Cardamom Client Portal & Store (AELA)

Last updated: 2026-09-06

This file is the one place to look to answer "what do we actually have right
now, and what's left to do." Update it whenever a milestone lands or a new
gap is found — it should always reflect the true current state, not a plan.

---

## 1. What this project is

A working demo built by Lycan Technolabs for Jinto Jomon's cardamom estate
business in Idukki, Kerala. One Next.js app doing two jobs:

1. **Client portal** — Jinto manages growers' estates and logs every visit
   (fertilizer rounds, spraying, harvest, curing) with photos as proof. Each
   grower signs in and sees only their own estate: work log, inputs applied,
   harvest and costs, itemised.
2. **Public site & store** — the business's own cardamom, sold direct to
   consumers. Guest checkout, no customer accounts, order tracking by
   order-number + email.

## 2. Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** Prisma 6 ORM, SQLite for local dev (schema is written to move
  to PostgreSQL/Neon later — see `prisma/schema.prisma` header comments)
- **Auth:** Auth.js (NextAuth) v5 beta, credentials provider, JWT sessions,
  Argon2 password hashing
- **Validation:** Zod
- **Rate limiting:** Upstash Redis when configured, in-process fallback
  otherwise
- **File storage:** pluggable driver — local disk for dev, S3-compatible
  (e.g. Cloudflare R2) for production, selected via `STORAGE_DRIVER`

## 3. How it's organized

```
src/
  auth.ts, auth.config.ts   Auth.js — credentials, JWT sessions
  proxy.ts                  Route-level redirects (Next 16 "proxy", was middleware)
  lib/session.ts            requireAdmin / requireClient / assertOwnership
  lib/queries.ts            Client-scoped reads — every one takes clientId first
  lib/attachment-access.ts  Shared authorization check for files + thumbnails
  lib/rate-limit.ts         Fixed-window limiter (Redis or in-process)
  lib/dpdp.ts               DPDP Act compliance posture — purposes, retention, rights
  app/(site)/               Public site + store (guest checkout)
  app/dashboard/            Grower portal
  app/admin/                Jinto's admin panel
```

**The security rule the whole project rests on:** a client ID is never read
from the request — it comes from the session, and every query is scoped by
it. Layouts (`requireClient`, `requireAdmin`) and every server action
re-check against the database; `proxy.ts` only handles navigation, it is not
the security boundary.

## 4. Feature inventory — what exists today

### Public site (`/`, `/services`, `/how-it-works`, `/about`, `/contact`, `/quality`, `/privacy`)
- Marketing homepage, service pages, DPDP privacy notice and data-request form
- Contact form (rate-limited, writes to Enquiries)

### Store (`/store`, `/store/[slug]`, `/cart`, `/checkout`, `/orders/lookup`)
- Product catalogue with pack-size variants, stock levels, images
- Cart (client-side, persisted), guest checkout (no account needed)
- Consent capture at checkout (DPDP s.6), stock decremented inside a
  transaction so a race can't oversell
- Order confirmation with order number; order tracking by number + email
  (correctly refuses on email mismatch — no data leak)
- Payment is **not wired up** — checkout says so explicitly ("Demo checkout —
  no payment is taken. Razorpay goes here...")

### Grower portal (`/dashboard/*`)
- Home dashboard: season totals, spend, last visit, upcoming picking rounds
- Work log / activity detail with photos, materials, workers, costs
- Harvest, inputs, expenses views
- Photo/video gallery, document library (lab reports, licences, invoices)
- Direct-to-storage upload flow (ticket-based, two-phase commit, server-side
  size/type enforcement — not client-trusted)
- Messaging with Jinto (one thread per grower, no polling by design)
- Profile, settings (password change, rate-limited), privacy (DPDP export/erasure request)
- Locale switch (English / Malayalam)

### Admin panel (`/admin/*`)
- Dashboard, Clients (list + detail, search), Activities/"Work log" (log new
  work, filter by client/type), Workers, Products (catalogue editor with
  stock stepper), Orders (status control), Reports (spend/harvest/store
  revenue by period, CSV export for clients), Messages, Enquiries
  (mark replied/closed), Website content CMS (business details, homepage
  copy, announcement banner — live immediately), Malayalam translation
  review queue, Permissions (per-grower feature overrides), Data requests
  (DPDP admin queue)

### Compliance (DPDP Act, 2023)
- Single source of truth in `src/lib/dpdp.ts` — purposes, lawful basis,
  retention periods, rights, grievance contact
- Consent captured and versioned at checkout
- Access (s.11) via `/api/my-data` — session-scoped, no parameters
- Erasure (s.12) anonymises orders rather than deleting (statutory
  bookkeeping requirement) and tells the person what was kept
- Retention purge job, breach register

## 5. What we did this session

### Environment setup (from a fresh clone)
1. `npm install`, `npx prisma generate`, `npx prisma db push`, `npx prisma db seed`
2. Created a local `.env` (`DATABASE_URL`, `AUTH_SECRET`, `STORAGE_DRIVER=local`, `NOTIFY_DRIVER=console`) — **there is no `.env.example` committed**, so this was reconstructed by grepping every `process.env.*` reference in the codebase
3. Verified clean `tsc --noEmit`, clean `eslint`, clean `next build`

### Full QA pass — every area of the app tested live
- Every admin page clicked through (Clients, Workers, Products, Orders,
  Reports, Messages, Enquiries, Website content, Permissions)
- Full guest purchase flow end-to-end: add to cart → checkout → order number
  → track by order number + email (including the wrong-email refusal case)
- Login security: wrong-password generic error (no user enumeration),
  rate-limit configuration read and confirmed sane (5/account per 15 min,
  50/IP per 10 min)
- Cross-tenant access (IDOR) attempts: another grower's activity page,
  another grower's attachment file, admin routes while logged in as a
  grower — all correctly blocked (404/redirect, zero data leaked)
- File-serving CSP sandbox confirmed live (blocks script execution on served
  attachments, exactly as intended)
- Mobile pass (375px): homepage, nav, store, product page, cart, checkout
  form, login, client dashboard, gallery/video player — all reflow correctly

### Bugs found and fixed
| # | Bug | Where | Fix |
|---|---|---|---|
| 1 | **Critical** — infinite request loop on `/admin/clients`. Opening the page alone hammered the server continuously (confirmed in server logs, every ~150–300ms, forever) | `src/app/admin/clients/client-search.tsx` | `useEffect` no longer depends on the ever-changing `useSearchParams()` object; reads latest params via a ref instead |
| 2 | Desktop sidebar (admin **and** client dashboard) scrolled away with page content on any page taller than one screen | `src/components/portal-shell.tsx` | Sidebar is now `sticky`, pinned to the viewport, independently scrollable |
| 3 | No pagination on Work Log / Orders admin lists — fetched the entire all-time history, unbounded, on every load | `src/app/admin/activities/page.tsx`, `src/app/admin/orders/page.tsx` | Paged at 50 rows with `skip`/`take` + a real count; Newer/Older footer only appears once there's more than one page |
| 4 | "1 workers" grammar bug on the admin Clients page | `src/app/admin/clients/page.tsx` | Job/worker counts now pluralize correctly |
| 5 | Demo login credentials (admin + client passwords) printed on the public sign-in page | `src/app/login/page.tsx` | Gated behind `NODE_ENV !== "production"` — confirmed absent from a real production build's HTML |
| 6 | Mobile hamburger menu wasn't a real overlay — no backdrop, page behind it kept scrolling | `src/components/site-header.tsx` | Now a genuine full-screen panel; locks `body` scroll while open, unlocks cleanly on close |

All six were verified fixed **live in the browser** (not just by reading the
diff) — the loop was watched stop in the server log, the sticky sidebar was
measured via computed styles after scrolling, the production build was
actually started and its HTML checked for the demo-credentials string, etc.
Final state: clean `tsc --noEmit`, clean `eslint`, clean `next build`.

## 6. What's still needed — punch list for next steps

Ranked by what actually blocks a real launch vs. nice-to-haves.

### Blockers before any real/public launch
- [ ] **Real payment gateway.** Checkout currently takes no payment at all —
  the code comment literally says "Razorpay goes here, with the order
  confirmed only after the webhook is verified." No orders should be
  fulfilled off this checkout as-is.
- [ ] **Real notification delivery.** `NOTIFY_DRIVER` is stubbed to console —
  growers don't actually get WhatsApp/SMS pings for anything yet. Needs a
  real WhatsApp Business API (or SMS) integration wired to `notify-providers.ts`.
- [ ] **Remove/verify demo data path.** The demo-credentials fix hides the
  UI block in production, but the seeded demo accounts (`jinto@aela.co.in`,
  `thomas@example.com`, etc.) still need real passwords rotated before any
  production database goes live — seeding is a dev/staging tool only.

### Should do soon (not blocking, but will bite)
- [ ] Commit an `.env.example` — the next person (or a fresh deploy) has to
  reverse-engineer every required env var from source otherwise.
- [ ] `npm audit`: 4 high-severity advisories, all in dev tooling
  (`prisma`'s transitive `deepmerge-ts`, and `nanoid`). Not exploitable at
  runtime, but `npm audit fix` clears the `nanoid` one; the Prisma one needs
  a version bump.
- [ ] Prisma flags a major version available (6.19.3 → 8.0.0-rc) — plan the
  upgrade, don't rush it.
- [ ] Migrate off SQLite to PostgreSQL/Neon before real concurrent traffic —
  the schema already anticipates this (see its header comments about money
  as Float → Int-paise, and `mode: "insensitive"` for search).
- [ ] The Work Log / Orders pagination added this session is a first pass
  (50/page, Newer/Older). Worth adding a date-range filter too once there's
  real multi-year history to page through.

### Ideas worth discussing (not problems, just gaps)
- Bulk actions on Orders/Enquiries (e.g. mark several replied at once)
- Search/filter on the Orders admin list (currently none — only client/type
  filters exist on Work Log)
- A proper image CDN/optimization pass once real product photography exists
  (current images are placeholder SVGs from the seed)

## 7. Running it locally

```bash
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```

Then open http://localhost:3000. Demo logins (dev/staging only, hidden in
production per fix #5 above):

| Role | Email | Password |
| --- | --- | --- |
| Admin (Jinto) | `jinto@aela.co.in` | `Admin@123` |
| Grower — 2 estates | `thomas@example.com` | `Client@123` |
| Grower — 1 estate | `rajan@example.com` | `Client@123` |
