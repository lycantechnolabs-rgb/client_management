import type { Translator } from "@/lib/i18n";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

export function money(value: number | null | undefined, exact = false) {
  if (value === null || value === undefined) return "—";
  return exact ? inrPaise.format(value) : inr.format(value);
}

export function kg(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value)} kg`;
}

/**
 * Dates in the reader's language.
 *
 * `ml-IN` gives Malayalam month names — a grower reading "സെപ്റ്റംബർ" rather
 * than "Sept" beside otherwise-Malayalam text. The locale is passed in rather
 * than read here: this file is imported by client components, and reaching for
 * cookies from a formatting helper would drag a request into every one of them.
 *
 * Defaults to en-IN, so every existing caller keeps its current output.
 */
export function shortDate(value: Date | string, locale = "en-IN") {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(locale === "ml" ? "ml-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function dayMonth(value: Date | string, locale = "en-IN") {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(locale === "ml" ? "ml-IN" : "en-IN", {
    day: "numeric",
    month: "short",
  });
}

/**
 * "Yesterday", "3 days ago" — in the reader's language.
 *
 * Takes a translator rather than returning English. Without it this was the
 * single most visible English word left on an otherwise-Malayalam dashboard:
 * the "Last visit" tile says one word, and that word was "Yesterday".
 */
export function relativeDays(value: Date | string, t?: Translator) {
  const d = typeof value === "string" ? new Date(value) : value;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  const say = (key: DateKey, vars?: Record<string, string | number>) =>
    t ? t(key, vars) : fallbackRelative(key, vars);

  if (days <= 0) return say("date.today");
  if (days === 1) return say("date.yesterday");
  if (days < 30) return say("date.daysAgo", { days });
  const months = Math.floor(days / 30);
  return months === 1
    ? say("date.oneMonthAgo")
    : say("date.monthsAgo", { months });
}

type DateKey =
  | "date.today"
  | "date.yesterday"
  | "date.daysAgo"
  | "date.oneMonthAgo"
  | "date.monthsAgo";

/** English, for the callers that have no translator to hand. */
function fallbackRelative(key: DateKey, vars?: Record<string, string | number>) {
  switch (key) {
    case "date.today":
      return "Today";
    case "date.yesterday":
      return "Yesterday";
    case "date.daysAgo":
      return `${vars?.days} days ago`;
    case "date.oneMonthAgo":
      return "1 month ago";
    default:
      return `${vars?.months} months ago`;
  }
}

export function monthLabel(value: Date | string, locale = "en-IN") {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(locale === "ml" ? "ml-IN" : "en-IN", {
    month: "long",
    year: "numeric",
  });
}

/** Order numbers look like CRD-7K3M9Q — short enough to read over the phone. */
export function makeOrderNumber() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `CRD-${out}`;
}

export function makeTempPassword() {
  const words = ["Elam", "Spice", "Green", "Hill", "Estate", "Pod", "Aroma"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}@${n}`;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
