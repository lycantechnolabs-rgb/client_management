/**
 * Activity types are seeded rows in the DB (see prisma/seed.ts) so Jinto can
 * add more without a deploy. This map only supplies presentation.
 */
export const ACTIVITY_TYPES = [
  { key: "FERTILIZER", label: "Fertilizer", icon: "Sprout", tone: "moss" },
  { key: "SPRAYING", label: "Spraying", icon: "SprayCan", tone: "info" },
  { key: "WEEDING", label: "Weeding", icon: "Scissors", tone: "sage" },
  { key: "IRRIGATION", label: "Irrigation", icon: "Droplets", tone: "info" },
  { key: "MULCHING", label: "Mulching", icon: "Layers", tone: "warning" },
  { key: "SHADE", label: "Shade regulation", icon: "TreePine", tone: "forest" },
  { key: "HARVEST", label: "Harvest", icon: "PackageOpen", tone: "success" },
  { key: "CURING", label: "Curing & drying", icon: "Flame", tone: "warning" },
  { key: "PLANTING", label: "Planting / gap filling", icon: "Shovel", tone: "moss" },
  { key: "INSPECTION", label: "Inspection", icon: "ClipboardCheck", tone: "muted" },
  { key: "OTHER", label: "Other work", icon: "Wrench", tone: "muted" },
] as const;

export type ActivityTypeKey = (typeof ACTIVITY_TYPES)[number]["key"];

export const activityLabel = (key: string) =>
  ACTIVITY_TYPES.find((t) => t.key === key)?.label ?? key;

export const MATERIAL_CATEGORIES = [
  { key: "FERTILIZER", label: "Fertilizer" },
  { key: "PESTICIDE", label: "Pesticide" },
  { key: "FUNGICIDE", label: "Fungicide" },
  { key: "GROWTH", label: "Growth promoter" },
  { key: "OTHER", label: "Other" },
] as const;

export const UNITS = ["kg", "g", "L", "ml", "nos", "bags"] as const;

/** Alleppey Green grades plus the bold-size grades used at auction. */
export const CARDAMOM_GRADES = [
  "AGEB — Alleppey Green Extra Bold",
  "AGB — Alleppey Green Bold",
  "AGS — Alleppey Green Superior",
  "8mm Bold",
  "7mm",
  "6mm",
  "Light / Open",
] as const;

export const WORKER_ROLES = [
  "Supervisor",
  "Harvester",
  "Sprayer",
  "General labour",
  "Watchman",
] as const;

export const DOCUMENT_CATEGORIES = [
  { key: "LAB_REPORT", label: "Lab / residue report" },
  { key: "AUCTION", label: "Auction slip" },
  { key: "INVOICE", label: "Invoice / bill" },
  { key: "LICENCE", label: "Licence / certificate" },
  { key: "OTHER", label: "Other" },
] as const;

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

export const SHIPPING_FLAT_RATE = 60;
export const FREE_SHIPPING_ABOVE = 1500;
