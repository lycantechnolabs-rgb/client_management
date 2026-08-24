# Cardamom — Client Portal & Store

Working demo for Jinto Jomon's cardamom business, built by Lycan Technolabs.

Two products in one Next.js app:

1. **Client portal** — Jinto manages growers' estates and records what he did, with photos as proof. Each grower signs in and sees their own work log, inputs applied, harvest and costs.
2. **Public site & store** — Jinto's own cardamom, sold direct. Guest checkout, no customer accounts.

## Running it

```bash
npm install && npm run db:push && npm run db:seed && npm run dev
```

Then open http://localhost:3000

### Demo logins

| Role | Email | Password |
| --- | --- | --- |
| Admin (Jinto) | `jinto@aela.co.in` | `Admin@123` |
| Grower — 2 estates, rich history | `thomas@example.com` | `Client@123` |
| Grower — 1 estate | `rajan@example.com` | `Client@123` |

Order tracking demo: `CRD-7K3M9Q` with `priya@example.com`.

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run db:reset` | Wipe and reseed the database |
| `npm run db:studio` | Browse the data in Prisma Studio |
| `npm run placeholders` | Regenerate the placeholder imagery |
| `node scripts/e2e.mjs` | End-to-end check (needs the dev server up) |
| `node scripts/security-suite.mjs` | Security suite — authn, isolation, uploads, headers (needs the dev server up, and a restart between runs) |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Prisma 6 · Auth.js v5 · Zod

## How it is put together

```
src/
  auth.ts, auth.config.ts   Auth.js — credentials, JWT sessions
  proxy.ts                  Route-level redirects (Next 16 "proxy", was middleware)
  lib/session.ts            requireAdmin / requireClient / assertOwnership
  lib/queries.ts            Client-scoped reads — every one takes clientId first
  app/(site)/               Public site + store
  app/dashboard/            Grower portal
  app/admin/                Jinto's admin
```

### Security model

The rule the whole project rests on:

> **A client ID is never read from the request. It comes from the session, and every query is scoped by it.**

- `proxy.ts` handles navigation redirects only. It is *not* the security boundary.
- Layouts (`requireClient`, `requireAdmin`) and every server action re-check against the database.
- The Credentials provider forces JWT sessions, so the `jwt` callback re-reads the user on every request — deactivating a grower logs them out immediately rather than at token expiry.
- Verified: a signed-in grower requesting another grower's activity gets a 404 with no data in the response.

Attachments follow the same rule. Photos and documents are written to
`private-uploads/`, which is outside `public/` and so is never served off the
filesystem. The only way to read one is `/api/files/<attachment id>`, which
looks the row up and answers 404 unless the caller is Jinto or the grower who
owns it — a 403 would confirm the file exists. Knowing the on-disk name buys
nothing: it is not reachable under any public path.

### Mobile-first

Jinto records work standing in an estate on his phone, and the growers are on phones too. So:

- Bottom tab bar under `lg`, sidebar above it — for both portals
- 44 px minimum tap targets, 16 px inputs (smaller inputs make iOS Safari zoom on focus)
- The "Log work" form uses `capture="environment"` so the camera opens directly
- Sticky save button, always reachable with a thumb

## Demo shortcuts — change these before production

| Area | Now | Production |
| --- | --- | --- |
| Database | SQLite (`prisma/dev.db`) | PostgreSQL on Neon — change `provider` in `schema.prisma` |
| File uploads | Written to `private-uploads/`, served through `/api/files/[id]` after an ownership check | Cloudinary private assets with signed expiring URLs — same route, different storage backend |
| Payment | Order marked paid directly | Razorpay, confirmed only after server-side webhook signature check |
| Money | `Float` rupees | `Int` paise, to avoid rounding on order totals |
| Imagery | Generated SVG placeholders | Real estate and product photography |
| Mascot | 3D render + CSS transforms | Re-render as separate transparent PNGs per limb, then rig in Rive |
| Contact form | Shows success, sends nothing | Needs a decision on where enquiries land |
| `AUTH_SECRET` | Committed demo value | `npx auth secret` |

## Known gaps

- Product and stock editing from the admin (seed data only for now)
- Messaging — deliberately left out; WhatsApp links are wired up instead
- Business name, logo and domain still pending, so the wordmark reads "CARDAMOM"
- The store is outside the signed SOW (excluded in Documents 04, 05 and 07) and needs a change request
