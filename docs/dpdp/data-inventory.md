# Data inventory

**Version:** 2026-09-01 · Every table holding personal data, what is in it, why,
and how long it stays.

Keep this current. If a migration adds a column that relates to a person, it
belongs here, and the notice in `src/lib/dpdp.ts` probably needs to change too.

---

## Growers

| Table | Personal data | Purpose | Basis | Retention |
| --- | --- | --- | --- | --- |
| `Client` | Name, phone, WhatsApp, email, postal address, village, district, free-text notes, nominee details | Running the estate management service | s.7(a) | Duration of engagement |
| `User` | Name, email, phone, password hash, last login | Portal sign-in | s.7(a) | Duration of engagement |
| `Plot` | Estate name, location, area, plant count | The service | s.7(a) | Duration of engagement |
| `Activity` | Work done, dates, costs, field notes, author | The service — this is the record the grower is paying for | s.7(a) | Duration of engagement |
| `Material` | Inputs applied and their cost | The service | s.7(a) | Duration of engagement |
| `Message` | Message body, sender, timestamps | Communication | s.7(a) | Duration of engagement |

> `Client.notes` and `Activity.notes` are free text. Anything typed there is
> personal data and will appear in a grower's data export. Worth saying to Jinto
> once: write what you would be content to read back to them.

## Estate workers

| Table | Personal data | Purpose | Basis | Retention |
| --- | --- | --- | --- | --- |
| `Worker` | Name, phone, address, role, daily wage, joining date | Recording who worked and what they are owed | s.7(i) — **fiduciary undetermined, see assessment §3** | Duration of engagement |
| `ActivityWorker` | Days worked, wage per activity | Wage accounting | s.7(i) | Duration of engagement |

> An `idNumber` column holding Aadhaar fragments was **removed** on 2026-09-01.
> Nothing read it and nothing wrote it. Do not reintroduce it without a purpose.

## Store customers

| Table | Personal data | Purpose | Basis | Retention |
| --- | --- | --- | --- | --- |
| `Order` | Name, email, phone, full delivery address, pincode, delivery notes | Fulfilling the order | s.6 consent | 8 years (accounting), then anonymised |
| `OrderItem` | What was bought | Fulfilling the order | s.6 consent | With the order |

> Erasure anonymises rather than deletes: name, contact and address are cleared,
> the order number, date and total remain. The books survive; the person does
> not. See `anonymiseCustomer` in `src/app/admin/actions.ts`.

## Files

| Table | Personal data | Purpose | Basis | Retention |
| --- | --- | --- | --- | --- |
| `Attachment` | Photographs and documents from estates — **may show identifiable workers** | Proof of work | s.7(a) for the grower; see assessment §4 for the people pictured | Duration of engagement |

> Bytes live in `private-uploads/`, outside the public directory, and are
> readable only through `/api/files/<id>` after an ownership check.

## Compliance records

| Table | Personal data | Purpose | Basis | Retention |
| --- | --- | --- | --- | --- |
| `ConsentRecord` | Email, purpose, notice version, grant/withdrawal | Evidencing that consent was validly taken | Necessary to demonstrate compliance | While it may need to be evidenced |
| `DataRequest` | Name, email, phone, what was asked, what was answered | Handling rights requests and grievances | Statutory obligation | While it may need to be evidenced |
| `BreachRecord` | Description, count affected, notification dates | s.8(6) obligations | Statutory obligation | Indefinite |
| `AuditLog` | User reference, action, entity, timestamp | Security monitoring and incident investigation | s.8(5) safeguards | 1 year |

## Not stored

- **Contact form** — displays success and stores nothing. No processing today.
  Wiring it up makes it a collection point; the consent component is already
  built for it.
- **Payment details** — none. Razorpay will hold card data; AELA will not.
- **Analytics or advertising** — none. No third-party trackers, no cookies
  beyond the session.

---

## Cross-border transfers

s.16 permits transfers except to countries the Central Government restricts by
notification — a blacklist, not a whitelist. Nothing here transfers personal
data abroad today. **This changes the moment hosting, image storage or a
messaging provider is chosen**, so record the region for each and check it
against any notified restrictions before signing.

## Children

No processing of children's data is intended. The store is not directed at
under-18s and collects no date of birth. If that ever changes, s.9 requires
verifiable parental consent and prohibits tracking and targeted advertising to
children — a materially different build.
