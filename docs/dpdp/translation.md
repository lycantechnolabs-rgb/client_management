# Machine translation, and what it costs in data terms

**Status: OFF.** No `TRANSLATE_PROVIDER` is configured, nothing has been sent
anywhere, and this document describes what would change if someone turned it on.

## Two layers, and only one of them has a bill

**What Jinto types himself.** Beside the title and notes on the work-log form
there are two Malayalam boxes, and on every existing entry there is a panel at
`/admin/activities/<id>`. What he writes there is stored and shown to growers
who have chosen മലയാളം. This needs no key, no billing and no contract, sends
nothing anywhere, and **nothing in the rest of this document applies to it** —
the text never leaves the server. It is also the better translation, because he
is a Malayalam speaker writing about his own estate.

**What the machine fills in.** Everything he did not translate by hand, if a
provider is configured. This is the part with a bill and the paperwork below.

The order is: what Jinto typed, then the provider, then the English. His wording
wins, and a sentence he has already translated is never sent to the provider at
all — so hand-translating the notes that matter also reduces what leaves the
country.

## What it is

Jinto types work-log titles and notes in English. The interface strings have a
Malayalam catalogue he reviews himself at `/admin/language`; his own sentences
cannot work that way, because he writes new ones every week. So when a grower
switches to മലയാളം, any sentence he has not translated himself is sent to a
translation provider, and the result is cached in `ContentTranslation` alongside
his hand-written ones — same table, same key, so the reader cannot tell them
apart and does not need to.

The code is `src/lib/translate/`. Three properties are load-bearing:

- **Off unless configured.** No key, no calls, English as before.
- **Cached by a hash of the source text.** A note is translated once, not on
  every page load. Editing the note changes the hash, so corrections are picked
  up; the stale row simply stops being read.
- **Fails open to English.** A provider that is down or rate-limited degrades to
  the original text, never to a broken page.

## What is sent, and what is not

Only the machine layer sends anything. What Jinto types by hand appears in
neither column — it stays in the database.

| Sent to the provider | Never sent |
|---|---|
| Activity titles | Grower names, phone numbers, addresses |
| Activity notes | Plot names, worker names, product names |
| Attachment captions | Any figure: weights, rates, costs, dates |
| | Photographs, video, documents |
| | The privacy notice (see below) |
| | Anything Jinto translated himself |

Names are excluded deliberately and not only for privacy: translating a proper
noun is how "Cheruvally Estate" becomes something nobody can find on a map.

This is not a clean separation. **A note can contain anything Jinto typed into
it** — "Rajan's team, 4 workers, told me the lower block is waterlogged again"
is a plausible note and contains a worker's name. The field boundary limits the
routine case; it does not guarantee the exceptional one. Anyone enabling this
should assume estate notes may contain personal data about third parties.

## The DPDP consequences

Under the Digital Personal Data Protection Act 2023:

1. **The provider becomes a Data Processor.** AELA (through Lycan Technolabs as
   its processor) is the Data Fiduciary. Google or Microsoft would be a
   sub-processor. **s.8(2) requires a contract.** Accepting a cloud provider's
   click-through terms is the usual route; somebody should confirm those terms
   actually cover processing on AELA's behalf, because the standard consumer
   terms of a translation API generally do not.

2. **The data leaves India.** Both providers process outside Indian borders
   unless a region is pinned, and even a pinned region is a foreign company's
   infrastructure. s.16 lets the Central Government restrict transfers to
   notified countries; as of this writing no restricting notification is in
   force, but this is a live area and the position can change.

3. **The privacy notice (s.5) is now incomplete.** `docs/dpdp/data-inventory.md`
   and the notice a grower reads at `/dashboard/privacy` describe where their
   data goes. Neither currently mentions a translation provider. **Enabling this
   without updating both makes the existing notice inaccurate**, which is a
   worse position than not offering translation at all.

4. **The cache is personal data.** `ContentTranslation` holds the source
   English alongside the Malayalam, so a note edited five times would otherwise
   leave five copies of text that exists nowhere else.

   The retention sweep (`src/lib/retention.ts`, run nightly and by the button in
   `/admin/privacy`) now drops any cached row whose source no longer matches a
   live activity title, note or caption. Deleting a row that is still wanted
   costs one re-translation, not correctness — it is a cache.

   **What this does not cover:** there is no erasure flow for a grower's own
   records at all — `anonymiseCustomer` handles store customers only. If one is
   ever built, it must clear this table in the same transaction. The sweep
   limits how long superseded text survives; it is not a substitute for erasure
   on request.

## Deliberately excluded: the privacy notice itself

The notice is not machine-translated and must not be. Legal text that tells
someone what rights they have is the one place where a plausible-sounding wrong
sentence does real harm — a mistranslated notice misinforms, where a missing one
merely omits. Its worksheet for a human translator is
`docs/dpdp/malayalam-translation.md`.

The same reasoning covers the rights form on `/dashboard/privacy`: the
difference between "correct something that is wrong" and "erase my data" decides
what actually happens to a grower's records, and a grower picking the wrong one
because of a machine draft is a real outcome. Those strings are left in English
pending the same human translation.

## Before turning this on

- [ ] Confirm the provider's terms cover processing on AELA's behalf (s.8(2))
- [ ] Add the provider to `docs/dpdp/data-inventory.md`
- [ ] Update the s.5 notice at `/dashboard/privacy` to name it
- [ ] Decide whether Jinto is told which of his notes have been sent abroad

**None of these are things I can do for you.** The first is a legal question
about a specific contract, and the last is AELA's call.

## What has not been tested

There is no API key in the development environment, so **the Google and Azure
providers have never run against a live endpoint.** What is verified is
structural: off by default, cache hit and miss, fail-open to English, hash
changes when the source is edited. What is not verified is that the request
shapes are right, that the responses parse, or that the Malayalam is any good.
The first live call will be the first real test. This is the same caveat that
applies to the S3 storage driver.
