# DPDP compliance assessment — AELA cardamom portal and store

**Status:** draft for client review · **Version:** 2026-09-01 · **Prepared by:** Lycan Technolabs

> This assessment was prepared by the development team, not by lawyers. It records
> what the software does, what the Act appears to require of it, and where a
> decision is needed from the client or from counsel. Three items marked
> **DECISION** below cannot be settled in code and should go to a solicitor
> before go-live. The Act was passed in 2023 and its Rules have been the subject
> of phased commencement — **confirm the current enforcement dates** rather than
> relying on the position recorded here.

---

## 1. Who is who

| Role under the Act | Who |
| --- | --- |
| Data Fiduciary | Jinto Jomon, trading as AELA, Idukki, Kerala |
| Grievance contact (s.13) | Jinto Jomon — `hello@aela.co.in`, 8590 657900 |
| Data Processors | Hosting provider; image/file storage once moved off local disk; payment gateway (Razorpay) once live; SMS/WhatsApp sender if added |
| Significant Data Fiduciary? | **No.** That status is notified by the Central Government based on volume and sensitivity. A single-estate business is not a plausible candidate. If it were ever notified, a resident DPO, an independent audit and a DPIA become mandatory. |

### The four groups of people in the system

1. **Growers** — clients whose estates AELA manages. They hold portal logins.
2. **Estate workers** — recorded by name, phone, wage and days worked. **They never
   touch the software and have never seen a notice.** See §3.
3. **Store customers** — guest checkout, no account.
4. **People in photographs** — estate photos routinely show workers at work.

---

## 2. Lawful basis, per purpose

The Act does not have a GDPR-style "legitimate interests" balancing test. Under
s.4, processing is lawful **only** with consent (s.6) or under one of the
enumerated legitimate uses (s.7). Every purpose must land in one or the other.

| Purpose | Basis | Reasoning |
| --- | --- | --- |
| Running a grower's account and work log | s.7(a) legitimate use | The grower voluntarily provided their details for this service and has not withdrawn. Notice still required. |
| Recording estate labour | s.7(i) employment purposes | See the open question in §3 — the basis holds, but the *fiduciary* may not be AELA. |
| Fulfilling a store order | s.6 consent | Taken at checkout, recorded with the notice version, withdrawable. |
| Replying to a contact-form enquiry | s.6 consent | See §7 — the form currently stores nothing, so nothing is processed. |

An alternative reading would place order fulfilment under s.7(a) as well, since
the customer volunteers the address precisely so the parcel can arrive. Consent
was implemented instead because it is the stricter of the two and costs the
customer one tick. **No objection is expected, but it is a choice worth recording.**

---

## 3. DECISION 1 — who is the fiduciary for worker data?

This is the sharpest issue in the system and it cannot be resolved in code.

Estate workers are Data Principals. Their names, phone numbers, addresses and
wages are held. They have not consented, and no notice has reached them.

s.7(i) permits processing "for the purposes of employment", which covers the
substance. The difficulty is *whose* employment. The workers are engaged on the
grower's estate. If the **grower** is the employer, then the grower is the Data
Fiduciary for that data and AELA is a **Data Processor** acting on their
instructions — which requires a written contract under s.8(2), and the
obligation to notify workers sits with the grower.

If **AELA** engages the workers, AELA is the fiduciary and owes them the notice
directly.

**Recommended action.** Establish the factual position for each grower, then
either (a) add a data-processing clause to the grower service agreement and give
growers a short worker notice to display, or (b) have AELA issue a plain
Malayalam notice to workers at the point of engagement. Until this is settled,
this is the most likely source of a valid complaint.

**Already done in code:** the `Worker.idNumber` field — documented as "Aadhaar
last 4 / employee ref" — has been removed. Nothing read it and nothing wrote it.
Holding Aadhaar fragments for no purpose is precisely what data minimisation
forbids, and Aadhaar carries its own statutory regime on top of this Act.

---

## 4. DECISION 2 — photographs of workers

Estate photographs are the product: they are the proof of work the whole portal
exists to show. They routinely contain identifiable people who are not the
grower.

The images are already well protected — stored outside the public directory and
served only after an ownership check. The question is not security but basis and
notice: a worker photographed on a Tuesday has not agreed to their image being
filed against a client account.

**Recommended action.** Either fold this into the worker notice from Decision 1,
or adopt a working practice of framing work rather than faces where the
photograph does not need the person to be identifiable. The second is cheaper
and needs no paperwork.

---

## 5. DECISION 3 — retention periods

The periods published in the notice are **our policy, not a number handed to
us**, so they must be defensible.

| Data | Period | Basis |
| --- | --- | --- |
| Store orders | 8 years | Books of account under the Companies Act and income-tax rules |
| Enquiries | 1 year | Operational judgement |
| Security and access logs | 1 year | Aligns with the log-retention expectation for incident investigation |
| Consent records | While needed | They evidence the lawfulness of everything else |
| Grower records | Duration of engagement | It is the service |

Note that the draft Rules' three-year erasure clock attaches to large
e-commerce, social media and online gaming platforms by user-count threshold.
This business is nowhere near those thresholds, so it does not apply — but
**confirm this against the Rules as finally notified.**

**Client to confirm** the eight-year figure with their accountant.

---

## 6. What the software now does

| Obligation | Where it lives |
| --- | --- |
| s.5 notice | `/privacy`, generated from `src/lib/dpdp.ts`; shown again at the point of collection by `ConsentNotice` |
| s.6 consent | Unticked box at checkout; rejected server-side if absent; recorded with the notice version, inside the order transaction |
| s.6(6) withdrawal | `/dashboard/privacy` — appends a withdrawal row rather than editing the grant |
| s.8(5) safeguards | Pre-existing: argon2 hashes, session-derived tenant scoping, private uploads behind an ownership check. 102 assertions in `scripts/security-suite.mjs` |
| s.8(6) breach | Breach register in `/admin/privacy`, tracking Board and Data Principal notifications separately |
| s.8(7) erasure | Retention rules in `src/lib/dpdp.ts`; purge tool in `/admin/privacy` |
| s.11 access | `/api/my-data` — session-scoped, no parameters, never returns a credential |
| s.12 correction / erasure | Request queue, plus customer erasure that anonymises orders and keeps the statutory accounting record |
| s.13 grievance | Published in the notice, the footer and the portal; 30-day clock shown against every request |
| s.14 nomination | Grower sets a nominee directly in `/dashboard/privacy` |

---

## 7. Open items before go-live

| # | Item | Owner |
| --- | --- | --- |
| 1 | Settle Decisions 1–3 above | Client + counsel |
| 2 | **Malayalam notice.** Growers are in Idukki and are entitled to the notice in an Eighth Schedule language. English is written; the Malayalam is deliberately untranslated pending a native speaker — a mistranslated legal notice misinforms rather than merely omits. | Client to appoint translator |
| 3 | **Contact form stores nothing but says "sent successfully".** No DPDP exposure today, because nothing is processed — but it misleads the user, and the moment it is wired up it becomes a collection point needing the consent already built for it. | Dev |
| 4 | **Retention purge runs by hand.** Move to a nightly scheduled job. A published retention period that nothing enforces is a promise not being kept. | Dev |
| 5 | **Processor agreements.** s.8(2) requires a contract with every processor. Needed for hosting, image storage, Razorpay and any messaging provider. | Client |
| 6 | **Breach drill.** The register exists; the 72-hour path to the Board has never been walked. Do it once on paper. | Client + dev |
| 7 | Grower erasure is deliberately not automated — it entangles statutory records and third-party worker data. Handle case by case through the queue. | Dev (documented) |
| 8 | Confirm current commencement dates for the Act and Rules | Counsel |

---

## 8. Penalty exposure, for proportion

The Act's schedule tops out at ₹250 crore for failure to take reasonable
security safeguards, ₹200 crore for failing to notify a breach, and ₹50 crore
for general contraventions. These are ceilings, not tariffs, and the Board must
consider the nature and gravity of the breach — a business this size would not
attract anything near them. The reason to note it is the ordering: **the
single most expensive failure is security, which is the part already in the
best shape.** The cheapest way to stay safe is to keep it that way.
