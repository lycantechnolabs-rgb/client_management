# Breach response runbook

**For:** Jinto Jomon · **Version:** 2026-09-01

A personal data breach is any unauthorised processing, or accidental
disclosure, loss, alteration or destruction of personal data. Under s.8(6) of
the Act, **every** breach is reportable — to the Data Protection Board *and* to
each affected person. There is no "too small to report" threshold, and no risk
assessment that lets you skip it.

Do not spend the first hour deciding whether it counts. If personal data went
somewhere it should not have, it counts.

---

## The first hour

1. **Stop it getting worse.** Take the affected account offline, revoke the
   session, or take the site down if that is what it takes. A few hours of
   downtime is cheaper than a wider disclosure.
2. **Do not delete anything.** Logs are the evidence of what happened and how
   far it went. `AuditLog` retains a year.
3. **Write down the time you found out.** The clock starts here, not when the
   breach began.
4. **Log it** in the admin under **Data requests → Breach register**. This
   generates a reference and starts tracking the two notifications separately,
   so neither can be quietly skipped.

## Within 72 hours — tell the Board

Report to the Data Protection Board of India with:

- What happened, and when you found out
- What kind of personal data, and roughly how many people
- What you have done to contain it
- What you are doing to stop it recurring
- Who they can contact — that is you

Then mark **Board notified** in the register.

If facts are still missing, report anyway with what you have and follow up.
Late-and-complete is worse than prompt-and-partial.

## Also — tell the people affected

Every affected Data Principal, in plain language. For growers, a phone call in
Malayalam is worth more than an email, and you should still send the written
notice afterwards so there is a record.

Tell them:

- What happened, in one or two sentences, without jargon
- What of theirs was involved
- What you have done about it
- What they should do — change a password, watch for a call claiming to be from
  you
- How to reach you

Then mark **People notified** in the register.

## Afterwards

- Fix the cause. Write what you did in the register and close it.
- If the cause was a code defect, add an assertion to
  `scripts/security-suite.mjs` so the same hole cannot reopen unnoticed.

---

## Things that are breaches, and are easy to miss

- Sending one grower's work log or photographs to another grower
- A shared or reused admin password
- A lost or stolen phone that is still signed into the admin
- A database backup left somewhere unencrypted or publicly readable
- Personal data pasted into an external tool or chat
- A contractor still holding access after the engagement ended

## Who to call

| | |
| --- | --- |
| Grievance Officer | Jinto Jomon — `hello@aela.co.in`, 8590 657900 |
| Developer | Lycan Technolabs |
| Regulator | Data Protection Board of India |
