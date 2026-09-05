/**
 * DPDP Act, 2023 — the one place the compliance posture is written down.
 *
 * Everything the app says to a Data Principal, and everything it does on a
 * timer, reads from here. If a purpose, a retention period or the grievance
 * contact changes, it changes once, in this file, and the notice, the consent
 * records and the purge all move together.
 *
 * The Act is not the GDPR and this file deliberately does not pretend it is.
 * There is no "legitimate interests" balancing test to fall back on: under
 * s.4, personal data may be processed only with consent (s.6) or for one of
 * the enumerated "certain legitimate uses" (s.7). Each purpose below names
 * which of the two it stands on.
 */

/**
 * Bump whenever the wording of the notice changes in a way that affects what
 * a person was told. Consent records store this, so a row proves what was on
 * screen at the time rather than merely that a box was ticked.
 */
export const NOTICE_VERSION = "2026-09-01";

/**
 * s.5 requires the notice to name someone who answers questions, and s.13
 * requires a published grievance route. For a business this size that is one
 * person; a Significant Data Fiduciary would have to appoint a DPO resident
 * in India, which does not apply here (see docs/dpdp/assessment.md).
 */
export const GRIEVANCE_OFFICER = {
  name: "Jinto Jomon",
  role: "Proprietor and Grievance Officer",
  email: "hello@aela.co.in",
  phone: "8590657900",
  phoneDisplay: "8590 657900",
  address: "Idukki, Kerala, India",
} as const;

/** Where a Data Principal goes if we do not resolve it. */
export const DATA_PROTECTION_BOARD = {
  name: "Data Protection Board of India",
  note: "A complaint may be made to the Board after exhausting the grievance route above.",
} as const;

/* -------------------------------------------------------------------------- */
/* Purposes — the itemised list s.5 requires                                   */
/* -------------------------------------------------------------------------- */

export type LawfulBasis = "CONSENT" | "LEGITIMATE_USE";

export type Purpose = {
  key: string;
  /** What we say to the person, in their words, not ours. */
  label: string;
  /** The itemised description of personal data, as s.5(i) requires. */
  data: string[];
  basis: LawfulBasis;
  /** The section relied on, so the claim can be checked rather than trusted. */
  basisNote: string;
};

export const PURPOSES: Purpose[] = [
  {
    key: "PORTAL_ACCOUNT",
    label: "Running your estate account and showing you the work log",
    data: [
      "Your name, phone number and WhatsApp number",
      "Your email address, used to sign in",
      "Your village, district and postal address",
      "Your estate names, locations, area and plant counts",
      "The work recorded on your estates, and its costs",
      "Photographs and documents from your estates",
    ],
    basis: "LEGITIMATE_USE",
    basisNote:
      "s.7(a) — you gave us these details yourself, to receive the service you asked for, and have not told us to stop.",
  },
  {
    key: "ESTATE_LABOUR",
    label: "Keeping a record of who worked on an estate, and what they were paid",
    data: [
      "Worker name and phone number",
      "Role, daily wage and days worked",
      "Address, where recorded",
    ],
    basis: "LEGITIMATE_USE",
    basisNote:
      "s.7(i) — employment purposes, and to protect the employer from loss or liability. See the assessment: whether the grower or AELA is the fiduciary here is a determination the client must record.",
  },
  {
    key: "ORDER_FULFILMENT",
    label: "Sending you the cardamom you ordered",
    data: [
      "Your name, email address and phone number",
      "Your delivery address and pincode",
      "What you ordered and what you paid",
    ],
    basis: "CONSENT",
    basisNote: "s.6 — taken at checkout, and withdrawable at any time.",
  },
  {
    key: "ENQUIRY",
    label: "Replying to a message you send us",
    data: ["Your name, email address and phone number", "What you wrote to us"],
    basis: "CONSENT",
    basisNote: "s.6 — taken on the contact form.",
  },
];

export const purposeLabel = (key: string) =>
  PURPOSES.find((p) => p.key === key)?.label ?? key;

/* -------------------------------------------------------------------------- */
/* Retention — s.8(7)                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Personal data must be erased once the purpose is served and retention is no
 * longer required by law. "Required by law" is doing real work here: tax rules
 * outlive the customer relationship, so an order is kept long after the parcel
 * arrives.
 *
 * Note the draft Rules' three-year erasure clock attaches to large e-commerce,
 * social media and gaming platforms by user-count threshold. A single-estate
 * cardamom shop is nowhere near it, so these periods are our own policy rather
 * than a number handed to us — which means they have to be defensible.
 */
export type RetentionRule = {
  key: string;
  label: string;
  days: number | null;
  reason: string;
};

export const RETENTION: RetentionRule[] = [
  {
    key: "ORDER",
    label: "Store orders and delivery addresses",
    days: 8 * 365,
    reason:
      "Books of account must be kept eight years under the Companies Act and the income-tax rules. Erasing an order sooner would break a statutory record.",
  },
  {
    key: "ENQUIRY",
    label: "Contact-form enquiries",
    days: 365,
    reason: "A year is long enough to pick up a conversation. After that it is clutter.",
  },
  {
    key: "CONSENT_RECORD",
    label: "Consent records",
    days: null,
    reason:
      "Kept while the consent is live and for as long as it may need to be evidenced. These prove the lawfulness of everything else.",
  },
  {
    key: "NOTIFICATION",
    label: "Sent notifications",
    days: 365,
    reason:
      "Each one records the number or address it went to, so it expires like anything else holding contact details. A year is long enough to answer \"were they told?\".",
  },
  {
    key: "AUDIT_LOG",
    label: "Security and access logs",
    days: 365,
    reason:
      "One year, matching the retention the Rules expect of logs used to detect and investigate incidents.",
  },
  {
    key: "CLIENT_RECORD",
    label: "Grower account and estate work history",
    days: null,
    reason:
      "Kept for as long as the grower is a client, because it is the service. Erased on request once the engagement ends and no statutory record depends on it.",
  },
];

export const retentionFor = (key: string) => RETENTION.find((r) => r.key === key);

/* -------------------------------------------------------------------------- */
/* Rights — s.11 to s.14                                                       */
/* -------------------------------------------------------------------------- */

export const REQUEST_KINDS = [
  {
    key: "ACCESS",
    label: "A copy of my data",
    section: "s.11",
    blurb: "A summary of the personal data we hold about you and what we do with it.",
  },
  {
    key: "CORRECTION",
    label: "Correct something",
    section: "s.12",
    blurb: "Tell us what is wrong, incomplete or out of date and we will fix it.",
  },
  {
    key: "ERASURE",
    label: "Erase my data",
    section: "s.12",
    blurb:
      "We will erase what we hold unless the law requires us to keep it — we will tell you which parts, and why.",
  },
  {
    key: "NOMINATION",
    label: "Nominate someone",
    section: "s.14",
    blurb:
      "Name a person who may exercise these rights for you if you die or cannot act for yourself.",
  },
  {
    key: "GRIEVANCE",
    label: "Raise a grievance",
    section: "s.13",
    blurb: "Tell us we have got something wrong about your data.",
  },
] as const;

export type RequestKind = (typeof REQUEST_KINDS)[number]["key"];

export const requestKindLabel = (key: string) =>
  REQUEST_KINDS.find((k) => k.key === key)?.label ?? key;

export const REQUEST_STATUSES = [
  { key: "RECEIVED", label: "Received", tone: "info" },
  { key: "IN_PROGRESS", label: "Being worked on", tone: "warning" },
  { key: "COMPLETED", label: "Completed", tone: "success" },
  { key: "REJECTED", label: "Declined", tone: "danger" },
] as const;

export const requestStatus = (key: string) =>
  REQUEST_STATUSES.find((s) => s.key === key);

/**
 * Our own response deadline. The Act leaves the period to the Rules and to what
 * a Data Fiduciary publishes for itself; publishing a number and then showing
 * the clock against it is the point.
 */
export const RESPONSE_DAYS = 30;

/** Breach notification to the Board. Kept here so the runbook and UI agree. */
export const BREACH_BOARD_HOURS = 72;

export function responseDueDate(from = new Date()) {
  const due = new Date(from);
  due.setDate(due.getDate() + RESPONSE_DAYS);
  return due;
}

/**
 * A short reference a person can quote on the phone. Ambiguous characters are
 * left out because these get read aloud to Jinto rather than copied.
 */
export function makeReference(prefix: string) {
  const alphabet = "ACDEFGHJKLMNPQRTUVWXY3479";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}-${out}`;
}

/* -------------------------------------------------------------------------- */
/* Language                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A Data Principal is entitled to the notice in English or any language in the
 * Eighth Schedule. The growers are in Idukki, so Malayalam is the one that
 * matters, and it is not optional in the long run.
 *
 * The English text is authored here and the Malayalam is deliberately NOT
 * machine-translated — a mistranslated notice is worse than an absent one,
 * because it misinforms rather than merely omits. Until a native speaker fills
 * these in, the policy page says plainly that a Malayalam copy is available on
 * request by phone, which is a real answer rather than a broken toggle.
 */
export const TRANSLATION_PENDING = true;

export const LANGUAGES = [
  { code: "en", label: "English", ready: true },
  { code: "ml", label: "മലയാളം", ready: false },
] as const;
