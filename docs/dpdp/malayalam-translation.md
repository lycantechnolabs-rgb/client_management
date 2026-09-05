# Malayalam translation worksheet

**For:** a Malayalam translator · **Version:** 2026-09-01

## Why this exists

Under the Act a Data Principal may ask for the notice in English or in any
language in the Eighth Schedule to the Constitution. The growers using this
portal are in Idukki and Malayalam is their reading language, so this is not
optional in the long run.

**The Malayalam has deliberately been left blank rather than machine-translated.**
A privacy notice that is mistranslated is worse than one that is missing: an
absent notice omits, a wrong one misinforms — and the person relying on it has
been told something untrue about their own rights.

Until this is filled in, `/privacy` says plainly that a Malayalam copy is
available by phone, and Jinto goes through it in Malayalam. That is a real
answer rather than a broken language toggle.

## For the translator

Please translate for a **grower standing in a field reading a phone**, not for
a lawyer. Where a legal term has no everyday Malayalam equivalent, prefer the
plain explanation over the technical word, and note the choice in the margin.
Section numbers and the two proper names below stay as they are.

Do **not** translate: `AELA`, `Data Protection Board of India`, section numbers
(`s.5`, `s.6`, …), email addresses, phone numbers.

## Where these strings live

All English source text is in `src/lib/dpdp.ts` and
`src/app/(site)/privacy/page.tsx`. When the Malayalam comes back, add it against
the `ml` entries in the `LANGUAGES` structure and flip `TRANSLATION_PENDING` to
`false`.

---

## Strings to translate

### Page heading and introduction

| Key | English |
| --- | --- |
| `title` | What we do with your details |
| `intro` | This is the notice the Act requires us to give you. It is written to be read, not to be survived — if any part of it is unclear, call Jinto on 8590 657900 and ask. |

### Section headings

| Key | English |
| --- | --- |
| `s.who` | Who holds your data |
| `s.what` | What we collect, and why |
| `s.not` | What we do not do |
| `s.keep` | How long we keep it |
| `s.rights` | What you can ask us to do |
| `s.security` | How it is kept safe |
| `s.complain` | If we get it wrong |
| `s.changes` | Changes to this notice |

### Purposes

| Key | English |
| --- | --- |
| `p.portal` | Running your estate account and showing you the work log |
| `p.labour` | Keeping a record of who worked on an estate, and what they were paid |
| `p.order` | Sending you the cardamom you ordered |
| `p.enquiry` | Replying to a message you send us |

### Rights

| Key | English |
| --- | --- |
| `r.access` | A copy of my data — a summary of the personal data we hold about you and what we do with it. |
| `r.correct` | Correct something — tell us what is wrong, incomplete or out of date and we will fix it. |
| `r.erase` | Erase my data — we will erase what we hold unless the law requires us to keep it, and we will tell you which parts, and why. |
| `r.nominate` | Nominate someone — name a person who may exercise these rights for you if you die or cannot act for yourself. |
| `r.grievance` | Raise a grievance — tell us we have got something wrong about your data. |

### Consent, shown at checkout

| Key | English |
| --- | --- |
| `c.heading` | What we do with what you have typed |
| `c.tick` | I have read the above and I agree to my details being used for this. |
| `c.withdraw` | You can ask for a copy of it, ask us to correct it, or ask us to erase it — and you can take this permission back at any time, as easily as you are giving it now. |

### What we do not do

| Key | English |
| --- | --- |
| `n.sell` | We do not sell your details, and we do not share them with anyone for their own marketing. |
| `n.track` | We do not track you around the internet, and there are no advertising or analytics cookies on this site. |
| `n.auto` | We do not use your details to make automated decisions about you. |
| `n.children` | We do not ask children for personal data, and the shop is not aimed at anyone under 18. |

### Grievance

| Key | English |
| --- | --- |
| `g.first` | Tell us first — it is the fastest way to fix it, and the Act expects you to have given us the chance. |
| `g.board` | If we do not sort it out, you can complain to the Data Protection Board of India. |

---

## Also worth translating

A short **worker notice** does not exist yet in English either, because who owes
it is still an open question (see `assessment.md` §3). When that is settled it
will need Malayalam from the start — the workers are the group least likely to
read English, and the group with the least ability to ask.
