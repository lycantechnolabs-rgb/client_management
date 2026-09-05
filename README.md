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
| `npm run verify:s3` | Round-trips a real bucket — run before trusting `STORAGE_DRIVER=s3` |
| `npm run check:uploads` | Checks the upload ceilings a deployment can actually honour |
| `npm run audit` | Walks every route as each role, then checks forms, images, SEO and error handling (needs the dev server up) |
| `npm run check:seed` | Checks the seed clears every table before it rebuilds |
| `node scripts/security-suite.mjs` | Security suite — authn, isolation, uploads, headers, DPDP (needs the dev server up, and a restart between runs) |

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

### The catalogue

`/admin/products` is where the shop is edited: products, pack sizes, prices and
stock, plus which products show and which are featured on the home page. Every
write revalidates both the admin list and the public pages that render the same
rows, so a price change is live on `/store` on the next request.

Two rules the page is built around:

- **Stock is a count, not a form field.** The number carries a −/+ stepper for
  the everyday case and takes a typed figure after a stock count. Checkout
  re-checks and decrements it inside a transaction, so an admin edit and an
  order landing at the same moment cannot oversell.
- **Nothing a customer has bought is quietly rewritten.** Order rows keep their
  own copy of the product name, pack label and unit price, so removing a pack
  cannot change what someone was charged. Deleting a product that has been
  ordered hides it from the shop instead, and says so.

### Data protection (DPDP Act, 2023)

The compliance posture lives in one file, [`src/lib/dpdp.ts`](src/lib/dpdp.ts):
purposes, lawful basis, retention periods, rights and the grievance contact. The
privacy notice at `/privacy`, the consent box at checkout, the grower's data
export and the retention purge all render from it, so the notice cannot drift
away from what the software actually does.

The Act is not the GDPR, and the code does not pretend it is. There is no
"legitimate interests" balancing test to fall back on: under s.4 processing is
lawful only with consent (s.6) or under an enumerated legitimate use (s.7), and
each purpose names which one it stands on.

- **Consent** is an unticked box, re-checked server-side, and the record is
  written inside the same transaction as the order — so we never hold an address
  without the evidence we were allowed to.
- **Access** (s.11) is `/api/my-data`. It takes no parameters at all: the client
  ID comes from the session, so there is nothing to tamper with. It never
  returns a password hash.
- **Erasure** (s.12) anonymises orders rather than deleting them — the books of
  account are a statutory record, so the person goes and the totals stay, and
  the customer is told exactly which parts were kept.
- **Breach** (s.8(6)) must go to the Board *and* to every person affected, with
  no "low risk" exemption, so the register tracks the two separately.

`docs/dpdp/` holds the paperwork: the assessment (including three decisions that
need the client and counsel), the data inventory, the breach runbook, and the
translation worksheet for the Malayalam notice.

### Website content (Doc 05)

`/admin/content` is where Jinto edits the public site — the wording on the home
page, the contact details, and an optional announcement strip. Doc 05 asks to
"manage public website content"; this is deliberately narrower than a CMS, and
the narrowness is the point.

- **The editable surface is a catalogue in code**
  ([`src/lib/site-content.ts`](src/lib/site-content.ts)), not the page. A CMS
  hands over headings, blocks and layout, and with them the ability to break a
  page badly enough that nobody notices for a week. Here every field is plain
  text rendered where it already sits, so the design cannot drift and adding a
  field is one entry plus one reference.
- **Plain text, never markup.** Angle brackets are refused on save. React
  escapes these anyway — the check exists so that pasting HTML fails loudly
  rather than printing itself onto the home page. Nothing is ever rendered with
  `dangerouslySetInnerHTML`.
- **Defaults in code, decisions in the database** — the same split as
  permissions. A key with no row, or a row someone emptied, falls back to what
  the code ships. The consequence worth stating: no state of the settings table
  can blank a heading, and an unreachable database still renders the site.
- **One source for the contact details.** The phone number used to be written
  out in five files plus the privacy notice. It is now one field, and changing
  it moves the contact page, the sign-in page, every grower's portal and the
  DPDP grievance route together. Contact details are not the notice's substance
  under s.5, so this does not bump `NOTICE_VERSION` or invalidate consent.
- Saving validates the whole form before writing anything and writes in one
  transaction, because a half-changed site with an error message is the worst
  outcome. Every change is audited by key.

The `Setting` table already existed, seeded with four rows nothing read — and
they had drifted, `business_name` saying "Cardamom" while every page said
"AELA". The seed no longer writes them: a row now means "somebody changed this
on purpose".

### Permissions (Doc 06)

Two roles today, `ADMIN` and `CLIENT`, plus per-grower permissions Jinto can
change himself. The split that makes this work:

- **Defaults live in code** ([`src/lib/permissions.ts`](src/lib/permissions.ts)) —
  they are product decisions that should move together for every grower. Adding
  a role is one entry in that catalogue; nothing else in the app enumerates
  roles.
- **Decisions live in the database** (`ClientPermission`) — and *only* the
  decisions. A grower with no row follows the default, so `absent` and `denied`
  stay distinguishable, and changing a default later moves everyone who was
  never given an explicit answer.

Permissions are read from the database on every request, never carried in the
session token. The portal already re-reads the user each request so deactivating
a grower signs them out immediately; a permission that waited for a token to
expire would not be a revocation. React's `cache()` collapses that to one query
per request.

Photographs also have a second door, `/api/thumb/[id]?w=…`, which returns a
resized WebP. It exists because Next's image optimiser fetches a source URL with
no session, so `/api/files` correctly hands it the same 404 a stranger gets —
private images cannot go through it, and the grid was asking for full-size
originals. A phone photograph is a few megabytes; the same photograph at grid
width is around 30 KB.

Both doors share one access check
([`src/lib/attachment-access.ts`](src/lib/attachment-access.ts)), because two
copies of an access rule is the shape that drifts — one gets a fix, the other
does not, and the one that did not is still serving other people's photographs.
Widths come from an allowlist rather than the query string, since each new width
is an encode and a cache entry; SVG is never rasterised, being XML with a parser
attached.

The gate that bites is `/api/files/[id]`, and the two refusals there are
different on purpose: **404** for a file that is not yours, because confirming it
exists would leak something; **403** for your own file when downloads have been
switched off, because pretending your photographs vanished would only confuse
you. The grower's screens say so rather than going quietly strange.

### One visit, several kinds of work

A round in an estate is rarely one thing — Jinto weeds and applies fertilizer on
the same walk. Splitting that into two entries divides the costs and the
photographs of a single visit across two rows on the grower's dashboard, so the
work-log form takes as many kinds as apply.

The storage is deliberately asymmetric. `Activity.type` remains the primary kind
and every existing reader keeps working untouched; `ActivityKind` rows hold only
the *extras*. Nothing is stored twice, so nothing can disagree, and the full set
is `[type, ...extraKinds]` — which
[`src/lib/activity-kinds.ts`](src/lib/activity-kinds.ts) is the only place that
knows.

The part that bites is filtering: a visit whose primary kind is Fertilizer but
which also covered weeding **must** appear under Weeding, or Jinto will believe
no weeding was done that month. `kindFilter()` looks in both places, and the
audit checks it from both directions.

`extraKinds` is a *required* prop on the activity card rather than optional. Left
optional, a query that forgets the relation still compiles and quietly renders
one badge — the visit loses the other kinds and nobody notices. Required means
the compiler names the query that forgot, which it did: three of them.

### English and മലയാളം

Some growers read only Malayalam, and the portal is what they sign into — so the
portal is what is translated. The public marketing pages are read mostly by
buyers and stay English for now; widening it later is adding keys, not changing
the mechanism.

**The Malayalam that ships is a machine draft, and nothing pretends otherwise.**
`src/lib/i18n/ml.ts` says so at the top, and `/admin/language` opens with a
banner saying it plainly. Jinto reads Malayalam, so the review happens in the
admin rather than in a code change: he sees the English beside each string,
corrects what is wrong, and what he types is what growers see from the next page
load. The estate vocabulary is the part most likely to be off — a grower in
Idukki may simply say something else, and the local word is the right one.

- **Three layers, most specific first:** Jinto's correction → the shipped draft
  → English. A key he has not reached shows in Malayalam; one with no Malayalam
  at all shows in English. Neither can render blank, and the audit checks that
  no string in either catalogue is empty.
- **The language lives on the account, not only in a cookie.** A grower who
  reads only Malayalam being dropped back into English by a cleared browser or a
  second phone is exactly the failure this exists to prevent. The cookie is what
  makes it work before signing in.
- **`<html lang>` is real.** A screen reader picks its voice from it, and a
  browser offers to translate a page that claims to be English while showing
  Malayalam.
- **Each group on the review screen saves on its own.** One form around all of
  them wrote a row for every string, so reading the menu marked the whole portal
  as checked by a Malayalam speaker — and the count of how much a human has
  actually read is the only thing that screen is for.
- **The switch shows both options in their own script.** A grower who reads only
  Malayalam cannot be asked to find "Language" in English to discover their own.

The privacy notice is deliberately **not** here. That is legal text, its
worksheet is `docs/dpdp/malayalam-translation.md`, and it wants a translator
rather than a review — a mistranslated notice misinforms where a missing one
merely omits.

### Grades a picking was sorted into

A round is not one grade. A picking is sorted into extra bold, bold and
superior, each with its own dried weight and its own rate — extra bold fetches
noticeably more. Recorded as one grade with one weight, the season's grade
report put every kilogram under whichever grade was chosen: a round of 40 kg
extra bold and 25 of bold reported 65 kg of extra bold. Not slightly wrong,
wholly so.

Unlike the other "extras" tables, these carry numbers rather than labels, so the
parent's totals are **derived from the lots** rather than stored beside them:

| Activity field | Comes from |
| --- | --- |
| `driedWeightKg` | the sum of the lots |
| `saleAmount` | the sum of the *priced* lots |
| `grade` | the heaviest lot |
| `ratePerKg` | the weighted average over priced weight |

Derived, not duplicated, is the point: one source of truth for how much was
picked, so the total and the breakdown cannot drift apart. The server computes
them and ignores what the browser claims, since trusting both independently
would let a round say 75 kg in its lots and 60 in its own field.

Two details that matter in a curing house: a lot with no rate yet **counts
toward weight but not money**, so a picking half sold reports what it actually
fetched; and a harvest with no lots at all falls back to its own single grade,
which is every harvest logged before this and any weighed before it was graded —
without that fallback the season's grade report would have lost its whole
history the day this shipped.

The audit checks that the breakdown still adds up to the season totals in both
weight and money.

### Blocks covered by a visit

A round rarely stops at a boundary — Jinto sprays the lower block and the upper
one on the same walk. The form takes as many blocks as apply, or none at all for
work that belongs to the estate as a whole.

This is the one of these changes that fixed a wrong number rather than a missing
field. **The round board computes each block's 45-day picking cycle from the
visits that touched it**, and it is how Jinto decides where to go next. Reading
only the foreign key, a block covered as the second half of a walk counted for
nothing: it showed "no harvest logged yet" the day after it was picked, and a
genuinely overdue block sat below it. Measured on a real two-block harvest —
the second block saw **0** cycle visits by the foreign key and **1** counting
extras.

Fixing that surfaced a second bug, which the multi-kind work had introduced:
`computeCycle` filters for `HARVEST` among a flat list of kinds, so a visit
logged as "fertilizer, and picked while we were there" — harvest as a
*secondary* kind — was invisible to the picking cycle. The board now expands
each visit twice, once per block and once per kind, before computing. Both are
checked in the audit.

Block ids are checked against the client on submit, like worker ids: an
unchecked one would file a visit against another grower's block, visible on
their dashboard and counted in their cycle.

### Who worked on a visit

The form only ever asked *how many*. `ActivityWorker` existed in the schema and
both detail pages rendered it, but nothing in the interface could create a row —
so a grower saw a headcount and never who was actually on their estate.

It is now a chip list of that client's active workers, with their role. The count
fills in from the names but stays editable, since casual hands are not on the
payroll, and the estimated day's wage is *offered* beside the cost field rather
than imposed — a day is not always a full day, and Jinto is the one who knows.

Two things the server does that the form cannot be trusted to:

- **Worker ids are checked against the client**, not accepted. A crafted post
  would otherwise attach one grower's named crew to another grower's visit, and
  the second grower would see those names on their own dashboard — a
  cross-tenant leak through a field nobody thinks of as sensitive. Verified by
  injecting a real worker id from another estate: it was dropped, and the
  legitimate selection was kept rather than the whole entry refused.
- **The wage is copied onto the row**, not read live afterwards, so a rise next
  season cannot silently rewrite what a visit last March cost. Same reason order
  items keep their own price.

Selecting a different client clears the crew, because a worker belongs to one
estate. Note that every client's workers — including `dailyWage` — are
serialised into this page as props, which is how switching client is instant.
That is fine for an admin-only form whose user can already list every worker; if
it is ever opened to anyone else, fetch them per client instead.

### Materials on a visit

Three things the materials rows do that they did not:

- **Tap what you used.** The chips above the rows are the inputs already logged
  on this book, most-used first, with the unit and category from the most recent
  entry for that name — so tapping three creates three named rows and the typing
  left is quantities. The list is derived
  ([`src/lib/common-materials.ts`](src/lib/common-materials.ts)) rather than
  hard-coded: a fixed list starts out wrong for this estate and drifts every
  season, while this one is right by construction and needs no maintenance.
- **A material can be more than one thing** — a drench that is both a fungicide
  and a growth promoter. Same asymmetric storage as the work kinds:
  `Material.category` is the primary, `MaterialCategory` rows are the extras.
- **The remove control is always there, at 44px.** It used to be 32px and to
  vanish when one row was left, so clearing a row typed by mistake meant
  emptying three fields by hand. It was also collapsing to 16px wide as a flex
  item — 44px tall is not a 44px target in the direction a thumb misses.

The arithmetic worth stating: the cost-by-category report **splits** a
multi-category material's cost between its categories rather than counting it in
full under each. Even splitting is a choice, not a truth — nothing in the data
says how much of a dual-purpose drench was fungicide — but it is the only
division that cannot be wrong in a particular direction, and the category totals
still sum to total spend, which is the property the report depends on. The audit
checks that sum.

### Grower uploads

Growers add their own photos, video and documents from `/dashboard/gallery` and
`/dashboard/documents`. Three things hold it together:

- **Two file pickers, not one.** `capture` is not a hint — on a phone it
  *replaces* the picker with the camera, and the browser then ignores
  `multiple`: one photo, with no way to reach the gallery. Both forms had it, so
  multi-select was inert on exactly the devices that matter. The work-log form
  now offers "Take a photo" (capture, one at a time, appends) beside "Choose
  from gallery" (multiple, no capture); the grower's form drops capture, since
  the camera is one tap away inside the picker anyway.

- **Large files bypass this server entirely.** A request body is capped at 4.5
  MB on Vercel — for Server Actions *and* route handlers — so a 200 MB estate
  video can never pass through the application. The browser asks for a **ticket**,
  sends the bytes to the address on it, then reports back; the server's job is
  authorising and verifying, not receiving. Limits are now what is sensible to
  keep rather than what the transport allowed: **50 MB images, 500 MB video,
  25 MB documents**.

  The ticket is what replaces inspecting the bytes on the way in. It is issued
  only after the permission check, it names the storage key (never the client),
  it caps the size, it expires, and it is single use. On completion the server
  reads the size **from storage** rather than believing the browser. The cap is
  counted as bytes arrive, because a declared `Content-Length` can lie and a
  body with no length at all is legal.

  `STORAGE_DRIVER` defaults to `local`, which streams to `private-uploads/` and
  needs no account — the same ticket flow, so the S3 driver has nothing new to
  prove about the parts above and below it. Set it to `s3` for a real
  deployment; **[docs/r2-setup.md](docs/r2-setup.md)** walks through
  Cloudflare R2 (chosen because egress is free and this portal serves video),
  **[docs/storage.md](docs/storage.md)** covers storage generally, and the CORS
  rules are the step everyone misses.

- **Those limits are only real once a bucket is configured.** `local` hands the
  browser a URL on this app's own origin, so on a serverless host the platform's
  4.5 MB body cap still applies — and it applies before any of our code runs,
  producing "Body exceeded … limit" and nothing a grower can act on.

  So the app clamps itself to what it can honour
  (`computeCapacity` in [`src/lib/upload-limits.ts`](src/lib/upload-limits.ts),
  environment read in `upload-capacity.ts`). The upload form is *handed* the
  effective numbers rather than importing the intended ones, the ticket is
  issued against the same figure it quotes when refusing, and a constrained
  deployment logs `[uploads] capacity reduced` at startup naming the fix.
  Nobody is promised capacity that does not exist. `npm run check:uploads`
  exercises the rule in all four configurations.

  The presigning is written out in [`src/lib/sigv4.ts`](src/lib/sigv4.ts) rather
  than pulled from the AWS SDK: the SDK is ten megabytes and dozens of packages
  for what amounts to two signed URLs, and this business is likelier to end up
  on Cloudflare R2 than AWS because R2 charges nothing for egress and this app
  serves video. The same signing covers S3, R2, B2 and MinIO. That is composing
  HMAC-SHA256 to a public spec, not inventing cryptography, and the failure mode
  is fail-closed and loud — a wrong signature is a 403, never a quietly weaker
  one. The key derivation is checked against AWS's own published vector in the
  suite, reimplemented there rather than imported, since a test that borrows the
  code it is testing proves only that the code equals itself.

  Reads keep the ownership check. With `s3` the route answers with a **302 to a
  URL signed for sixty seconds** instead of the bytes: pulling a 200 MB video
  through a serverless function to hand it on would be slow, costly and capped
  anyway. That URL is a bearer token for its lifetime, which is why it is short
  and why the redirect is `no-store`. Uploads run one file at a time with real progress: parallel transfers
  on a thin uplink all slow together, and one failing takes its share of the
  bandwidth with it.

- **Jinto's work-log form still posts inline**, so its photos are shrunk in the
  browser first. A Server Action carries its
  whole payload in the request body, and that body is capped — 1 MB by Next's
  default, 4.5 MB by Vercel's platform whatever Next is told to allow. A phone
  photograph is three to six megabytes, so the form promised 25 MB that the
  transport could never deliver and the framework refused it *before* any of our
  code ran, giving a runtime error page instead of a message. Photos are now
  resized to 1920px WebP client-side, which also means a grower on a hillside is
  not pushing six megabytes uphill to prove a round was picked. The original is
  not kept; full-resolution originals would need direct-to-storage uploads, not
  a bigger limit.
- **The limits live in a module with no runtime imports**
  (`src/lib/upload-limits.ts`). The browser needs them to check a file before
  sending, and importing them from the server module pulled `node:fs/promises`
  into the client bundle — which Turbopack reports as a panic, not a readable
  error.
- **One validator, two callers.** `src/lib/uploads.ts` is the only place an
  upload is checked and stored; Jinto's work-log form and a grower's form both
  go through it. Two copies would drift, and the copy that drifted would be the
  one that accepted something it should not have.
- **The caller narrows what it will take.** The gallery form passes
  `["IMAGE", "VIDEO"]`, so a PDF renamed to `.jpg` is refused server-side — the
  browser's `accept` attribute is a convenience for the person choosing a file,
  not a check. The refusal happens before any bytes are written.
- **Every row records who added it** (`Attachment.uploadedById`, null for
  Jinto's). This is what makes "delete their own uploads" mean anything:
  without it the data could only say a file belongs to a grower's account, not
  that the grower is the one who put it there — and the permission would quietly
  become a licence to delete the photographic record of work done on the estate.

Deleting therefore checks two things, not one: the permission, and that this
particular file is theirs. Grower uploads also surface under **"Sent in by
&lt;name&gt;"** on the admin client page — every other attachment there arrives
through an activity Jinto logged, so without that section a grower's file would
land where nobody would ever see it.

### Enquiries, search and self-service

Three contracted pieces that had been missing:

- **Client search** (`/admin/clients?q=`) filters in the database rather than
  the browser. The list is small today, but it is the one that grows with the
  business, and a client-side filter would quietly stop working at exactly the
  size where searching starts to matter. SQLite's `LIKE` is already
  case-insensitive for ASCII — **moving to Postgres will need
  `mode: "insensitive"` added**, or searching "thomas" stops finding "Thomas".
- **Settings** (`/dashboard/settings`) is where a grower changes their own
  password. `mustChangePassword` was being set when Jinto issued a temporary
  one and there was nowhere to act on it — the flag was written, read into the
  session, and never cleared. The current password is required even inside a
  session: a session proves someone signed in once, not who is holding the
  phone now.
- **Enquiries** are stored and shown at `/admin/enquiries`. The contact form
  previously displayed "sent successfully" and did nothing — which is worse
  than no form, because it loses the message and tells the sender it did not.

Two deliberate limits. A grower cannot change their own **sign-in email**: that
address lives on `User` while the one on their client record lives on `Client`,
so editing the second would do nothing useful, and editing the first without a
verification step is an account-takeover path. And there is no reply box on the
enquiries screen — Jinto answers by phone, WhatsApp or his own email and marks
it here, because a reply box that quietly went nowhere is the bug this feature
exists to fix.

### Messages

One conversation per grower, both portals, at `/dashboard/messages` and
`/admin/messages`. Three things shape it:

- **Not a chat app.** No polling, no socket, no typing indicator. Two people
  exchanging a few notes a week about an estate do not need a live connection,
  and holding one open would spend a grower's data allowance on something that
  changes twice a month.
- **Read state is asymmetric.** Opening a thread marks read only the messages
  the viewer *did not* write, so Jinto's own unanswered messages never count as
  his unread mail. The single `readAt` column can express this because each
  message has exactly one recipient — that stops being true the moment Doc 06's
  future Manager or Support Staff roles join a conversation.
- **A grower's thread comes from their session.** There is no client ID in
  their request to tamper with. The admin names the grower, and that is the one
  path where the ID arrives from the request, so it is checked against the
  database rather than trusted.

Nothing here reaches a phone on its own. The grower's screen says so and keeps
Jinto's number next to it, and the admin thread carries Call and WhatsApp
buttons — the out-of-band nudge is still the phone.

### Messages and reports

**Messages** are one conversation per grower, not an inbox — every message
belongs to an estate relationship, and threading by subject would invent a
structure neither side thinks in. Read state rides on a single `readAt` column,
which works only because each message has exactly one recipient: the party who
did not send it. That stops being true the moment a third role joins a
conversation, so it is worth remembering before Manager or Auditor arrive.

There is no polling and no socket. Two people exchanging a few notes a month
about an estate do not need a live connection, and holding one open would spend
a grower's data allowance on nothing. Both portals say plainly that a message
does not ring anyone's phone, and keep the WhatsApp and call buttons next to it.

**Reports** (`/admin/reports`, admin only per Doc 06) deliberately go a level
below the admin home, which already carries the headline figures: not *how much
was spent* but what on, not *how much was dried* but what came back per kilo
picked. The period is a link rather than a control, so a report is a URL that
can be sent to the accountant as-is, and the per-client table downloads as CSV.

One number there earns its place: **curing recovery**, dried weight as a share
of green. Cardamom loses roughly four fifths of its weight in the curing house,
so this sits near 20%; a figure drifting away from that is the earliest sign
something is wrong with the curing — or with how the weights are being written
down. The page says so when it strays outside 16–24%.

The CSV is written with a UTF-8 byte-order mark. Excel on Windows reads a CSV as
UTF-8 only when the file says so, and without it every rupee sign arrives
mangled.

### Notifications and the nightly job

Until now every feature ended the same way: "this does not reach anyone's
phone." Messages, enquiries, rights requests and the round board all computed
something useful and then waited for somebody to open a screen. This is the
delivery half.

**An outbox, not an inline send.** Actions queue a notification and return; a
separate dispatcher sends it. Three reasons: a grower's message must not fail
to save because WhatsApp is having a bad afternoon, retries need somewhere
durable to count from, and "what did we send, to which number, and when" gets
asked — by Jinto chasing a grower who says they were never told, and under DPDP,
where those contact details are personal data being used for a purpose.

Rows are claimed out of `PENDING` before the provider is touched, so two
overlapping runs cannot both send the same one, and anything scheduled carries a
dated `dedupeKey` so a cron that fires twice still sends once.

**Nothing is actually sent yet.** `NOTIFY_DRIVER` defaults to `console`: the
whole pipeline runs and every notification is written to the server log. The
admin screen says so in as many words, because otherwise a column of green
`sent` badges would eventually be mistaken for growers having been told. The
WhatsApp adapter is written but has no number provisioned — with no credentials
it fails loudly rather than pretending. Note the Cloud API will not deliver
free-form text outside a 24-hour window, so each notification kind needs an
approved template before any of it reaches a phone.

**On DPDP:** everything queued is transactional — a message about your own
estate, an enquiry you sent, a right you exercised. That rides on the basis the
rest of the account already stands on. Marketing would need its own consent
under s.6, so there is deliberately no broadcast helper in `src/lib/notify.ts`
for anyone to reach for, and the suite asserts one has not appeared.

**The nightly job** (`/api/cron`, 01:30, see `vercel.json`) queues the round
digest, drains the outbox, then runs the retention purge that previously only
ran when Jinto pressed a button — so the erasure the privacy notice promises
now actually happens on the schedule it publishes. The endpoint is guarded by
`CRON_SECRET` with no development escape hatch: something that erases personal
data on a timer does not get to run because a variable happened to be unset.

### Mobile-first

Jinto records work standing in an estate on his phone, and the growers are on phones too. So:

- Bottom tab bar under `lg`, sidebar above it — for both portals
- 44 px minimum tap targets, 16 px inputs (smaller inputs make iOS Safari zoom on focus)
- The "Log work" form uses `capture="environment"` so the camera opens directly
- Sticky save button, always reachable with a thumb
- `viewportFit: "cover"` in the root layout, so `env(safe-area-inset-bottom)`
  actually resolves — without it the tab bar's padding is zero and the bar sits
  under the home indicator
- Zoom is never blocked (`maximumScale: 5`); the growers are not all young

Every route is checked at **320 px**, not just 375 — an old Android or an
iPhone SE is a real device here, and it is where a row of controls stops
fitting. Two rules came out of that audit:

- **A control row must be able to wrap or stack.** The pack row on
  `/admin/products` once put a stepper, a price and two buttons on one line;
  at 320 px the delete button was pushed outside the card and silently clipped
  — present in the DOM, invisible and untappable. Label and price now share the
  first line, controls the second.
- **44 px is the bar for a control, 24 px for a text link.** The 44 px figure
  (Apple HIG, WCAG 2.5.5) applies to buttons, chips, steppers and tap-to-call.
  A link inside a sentence is exempt under WCAG 2.5.8 and is left alone —
  padding it would break the line spacing of the paragraph around it.

## Demo shortcuts — change these before production

| Area | Now | Production |
| --- | --- | --- |
| Database | SQLite (`prisma/dev.db`) | PostgreSQL on Neon — change `provider` in `schema.prisma` |
| File uploads | `STORAGE_DRIVER=local` — written to `private-uploads/`, served through `/api/files/[id]` after an ownership check | **Required before any serverless deploy.** `STORAGE_DRIVER=s3` against Cloudflare R2 — [docs/r2-setup.md](docs/r2-setup.md). Without it the app finds no persistent disk and switches uploads off, logging `[uploads] DISABLED`. A VPS with a real disk needs no bucket |
| Payment | Order marked paid directly | Razorpay, confirmed only after server-side webhook signature check |
| Money | `Float` rupees | `Int` paise, to avoid rounding on order totals |
| Imagery | Stock/generated photography for the store, heroes and `/quality`; SVG illustrations for the nine-scene gallery and estate attachments | Photography of **Jinto's own estate and crop** — what is there now is generically correct cardamom, not his hillside |
| Mascot | 3D render + CSS transforms | Re-render as separate transparent PNGs per limb, then rig in Rive |
| Contact form | Stored in the admin at `/admin/enquiries` | Notify Jinto when one arrives (email or WhatsApp) — nothing in the code has to change for it |
| `AUTH_SECRET` | Committed demo value | `npx auth secret` |

## Known gaps

- Doc 06 contradicts itself on downloads: the matrix grants them unstarred, s.4
  lists them as configurable. Implemented as configurable, defaulting to on —
  needs the client to confirm
- Product images are chosen from files already in `public/` — uploading one from
  the admin waits on the move to hosted image storage
- No photography exists for the decorticated seed or the ground powder, so those
  two store cards still show illustrations while the whole-pod products show
  photographs
- The Malayalam privacy notice is not written. Growers are entitled to it and the
  English is ready to translate — deliberately not machine-translated, because a
  wrong legal notice misinforms where a missing one merely omits
- Who owes estate workers their privacy notice — AELA or the grower — is an open
  legal question, not a coding one (`docs/dpdp/assessment.md` §3)
- Business name, logo and domain still pending. The name is now a field in
  `/admin/content` rather than a code edit, so settling it is one save
- The store is outside the signed SOW (excluded in Documents 04, 05 and 07) and needs a change request
