/**
 * The parts of the public website Jinto can edit himself.
 *
 * Doc 05 asks for "Website Content — manage public website content". This is
 * deliberately *not* a general content management system, and the difference
 * matters:
 *
 * A CMS hands over the page — headings, blocks, layout, images, rich text — and
 * with it the ability to break a page badly enough that nobody notices for a
 * week. It also means storing markup written by a person and rendering it into
 * a public page, which is stored cross-site scripting waiting to happen unless
 * every field is sanitised on the way out, forever.
 *
 * What actually changes on a site like this is a short, knowable list: the
 * phone number, the email, the sentence at the top of the home page, a note
 * when the harvest is in. So the editable surface is a **catalogue declared in
 * code**, every field plain text, rendered where it already sits. The design
 * cannot drift, the markup cannot be injected, and adding a field is one entry
 * here plus one reference in a page.
 *
 * Defaults live in code, decisions live in the database — the same split the
 * permissions catalogue uses. A field with no row falls back to the default, so
 * an empty database renders the site exactly as it ships and a missing row can
 * never blank a heading.
 */

export type ContentField = {
  key: string;
  label: string;
  /** What this controls, in the admin. */
  help: string;
  /** Shown when there is no row. Never blank for anything structural. */
  fallback: string;
  group: string;
  multiline?: boolean;
  maxLength: number;
  /** Fields that may legitimately be empty — an announcement, mainly. */
  optional?: boolean;
  /** Checked on save, so a broken tel: link cannot be published. */
  kind?: "phone" | "email";
};

export const CONTENT_FIELDS: ContentField[] = [
  /* --- the details that appear in a dozen places ------------------------- */
  {
    key: "business_name",
    label: "Business name",
    help: "The wordmark in the header, the footer and the copyright line.",
    fallback: "AELA",
    group: "Business details",
    maxLength: 60,
  },
  {
    key: "contact_phone",
    label: "Phone number",
    help: "Used for every tap-to-call link, on the site and in the portal.",
    fallback: "8590657900",
    group: "Business details",
    maxLength: 20,
    kind: "phone",
  },
  {
    key: "contact_phone_display",
    label: "Phone, as written",
    help: "How the number is printed. Spacing only — the link uses the field above.",
    fallback: "8590 657900",
    group: "Business details",
    maxLength: 24,
  },
  {
    key: "contact_email",
    label: "Email address",
    help: "Shown on the contact page and in the privacy notice.",
    fallback: "hello@aela.co.in",
    group: "Business details",
    maxLength: 120,
    kind: "email",
  },
  {
    key: "whatsapp",
    label: "WhatsApp number",
    help: "With the country code and no plus sign — 91 then the number.",
    fallback: "918590657900",
    group: "Business details",
    maxLength: 20,
    kind: "phone",
  },

  /* --- the home page ------------------------------------------------------ */
  {
    key: "home_eyebrow",
    label: "Line above the headline",
    help: "The small line in the badge at the top.",
    fallback: "Cardamom estate management · Idukki",
    group: "Home page",
    maxLength: 80,
  },
  {
    key: "home_headline",
    label: "Headline",
    help: "The largest words on the site. Short works better than clever.",
    fallback: "Your estate, managed in the open",
    group: "Home page",
    maxLength: 90,
  },
  {
    key: "home_intro",
    label: "Opening paragraph",
    help: "The two or three sentences under the headline.",
    fallback:
      "We run cardamom estates for growers across the Idukki hills — and we show you every day's work on your phone. Every fertilizer round, every harvest, every rupee. Nothing you have to take on trust.",
    group: "Home page",
    multiline: true,
    maxLength: 400,
  },

  /* --- a temporary notice ------------------------------------------------- */
  {
    key: "announcement",
    label: "Announcement",
    help: "A strip across the top of the public site. Leave empty for none.",
    fallback: "",
    group: "Announcement",
    optional: true,
    maxLength: 160,
  },
];

export type ContentKey = (typeof CONTENT_FIELDS)[number]["key"];

/** Everything, as it ships. The site renders correctly from this alone. */
export const CONTENT_DEFAULTS: Record<string, string> = Object.fromEntries(
  CONTENT_FIELDS.map((f) => [f.key, f.fallback]),
);

export const CONTENT_GROUPS = [
  ...new Set(CONTENT_FIELDS.map((f) => f.group)),
];

export function contentField(key: string) {
  return CONTENT_FIELDS.find((f) => f.key === key);
}

/**
 * Check one value the way the save does.
 *
 * Returns an error message, or null. Kept here rather than in the action so the
 * rules are next to the field that declares them.
 */
export function validateContent(field: ContentField, raw: string): string | null {
  const value = raw.trim();

  if (!value) {
    return field.optional ? null : `${field.label} cannot be empty.`;
  }
  if (value.length > field.maxLength) {
    return `${field.label} is longer than ${field.maxLength} characters.`;
  }
  // Plain text only. These are rendered as text by React, so this is not the
  // thing standing between us and an injection — it is here to catch someone
  // pasting markup and wondering why the page shows angle brackets.
  if (/[<>]/.test(value)) {
    return `${field.label} cannot contain < or >. This is plain text, not HTML.`;
  }
  if (field.kind === "phone" && !/^[0-9][0-9 ]{6,19}$/.test(value)) {
    return `${field.label} should be digits, optionally spaced.`;
  }
  if (field.kind === "email" && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(value)) {
    return `${field.label} does not look like an email address.`;
  }
  return null;
}
