/**
 * The permission catalogue — Doc 06, "User Roles & Permissions".
 *
 * Two things the spec asks for, and how this file delivers them:
 *
 *   "designed so additional roles can be added in future without major code
 *    changes"  — a role is a key in ROLE_DEFAULTS. Adding Manager or Auditor is
 *    one entry here; nothing else in the app enumerates roles.
 *
 *   "the administrator can enable or disable permissions for each client
 *    individually without changing the application code"  — every decision Jinto
 *    makes is a row in ClientPermission. This file supplies only the defaults.
 *
 * The split matters. Defaults live in code because they are product decisions
 * that should move together across every grower. Overrides live in the database
 * because they are Jinto's decisions about one person. A grower with no row
 * follows the default, so changing a default here moves everyone who was never
 * given an explicit answer — and leaves alone everyone who was.
 */

export const ROLES = ["ADMIN", "CLIENT"] as const;
export type Role = (typeof ROLES)[number];

export type Permission = {
  key: string;
  /** What Jinto sees on the toggle. */
  label: string;
  /** What turning it off actually does, in his words. */
  description: string;
  /** Groups the toggles on the admin screen. */
  group: "Files" | "Account";
  /**
   * Whether the admin may change it for a client at all. The matrix in Doc 06
   * marks the configurable ones with an asterisk; the rest are fixed rights
   * that come with the role and are listed here so the screen can show them as
   * settled rather than leaving Jinto wondering where they went.
   */
  configurable: boolean;
  defaults: Record<Role, boolean>;
};

/**
 * Doc 06's matrix, in order. The starred rows are `configurable: true`.
 *
 * One inconsistency in the source document, resolved deliberately: the matrix
 * gives "Download Own Files" to clients unstarred (so, fixed), but s.4 then
 * lists downloads among the things an administrator may allow or prevent. The
 * stricter reading is the useful one — Jinto may want to suspend a grower's
 * access without deleting their account — so it is configurable and defaults to
 * on. Flagged for the client to confirm.
 */
export const PERMISSIONS: Permission[] = [
  {
    key: "UPLOAD_PHOTOS",
    label: "Upload photos",
    description:
      "Add their own pictures to their estate record, alongside the ones you take.",
    group: "Files",
    configurable: true,
    defaults: { ADMIN: true, CLIENT: true },
  },
  {
    key: "UPLOAD_VIDEOS",
    label: "Upload videos",
    description: "Add their own video to their estate record.",
    group: "Files",
    configurable: true,
    defaults: { ADMIN: true, CLIENT: true },
  },
  {
    key: "UPLOAD_DOCUMENTS",
    label: "Upload documents",
    description: "Add lab reports, auction slips or bills to their documents.",
    group: "Files",
    configurable: true,
    defaults: { ADMIN: true, CLIENT: true },
  },
  {
    key: "DELETE_OWN_UPLOADS",
    label: "Delete their own uploads",
    description:
      "Remove a file they added themselves. They can never remove one you added.",
    group: "Files",
    configurable: true,
    // Doc 06 marks this "Configurable" rather than granting it, so it starts
    // off. Deletion is the one file action that loses something.
    defaults: { ADMIN: true, CLIENT: false },
  },
  {
    key: "DOWNLOAD_OWN_FILES",
    label: "Download their files",
    description:
      "Open and save the photos and documents on their estate. Turning this off leaves them able to sign in but not to take anything away.",
    group: "Files",
    configurable: true,
    defaults: { ADMIN: true, CLIENT: true },
  },
  {
    key: "EDIT_BUSINESS_INFO",
    label: "Edit their estate details",
    description:
      "Change the business information on their own record — estate names, areas, plant counts.",
    group: "Account",
    configurable: true,
    // The portal has no grower-facing editor for this yet, so it starts off
    // rather than promising something that is not there.
    defaults: { ADMIN: true, CLIENT: false },
  },

  /* Fixed rights — shown on the admin screen, but not switchable. */
  {
    key: "VIEW_OWN_DASHBOARD",
    label: "See their own dashboard",
    description: "Comes with having an account. Deactivate the client instead.",
    group: "Account",
    configurable: false,
    defaults: { ADMIN: true, CLIENT: true },
  },
  {
    key: "EDIT_OWN_PROFILE",
    label: "Edit their own profile",
    description: "Their own name and contact details. Always theirs to change.",
    group: "Account",
    configurable: false,
    defaults: { ADMIN: true, CLIENT: true },
  },
];

export type PermissionKey = string;

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export const permissionByKey = (key: string) =>
  PERMISSIONS.find((p) => p.key === key);

export const CONFIGURABLE = PERMISSIONS.filter((p) => p.configurable);

/** Groups, in the order the admin screen should render them. */
export const PERMISSION_GROUPS = ["Files", "Account"] as const;

/**
 * What a role gets before the admin has decided anything.
 *
 * An unknown key is denied rather than allowed. A typo in a permission check
 * should lock a door, not open one.
 */
export function roleDefault(role: string, key: string): boolean {
  const permission = permissionByKey(key);
  if (!permission) return false;
  return permission.defaults[role as Role] ?? false;
}

/**
 * Resolve one permission from a role plus whatever overrides are stored.
 *
 * Admins are not subject to overrides: ClientPermission rows are about a
 * grower's account, and there is no route by which one could apply to Jinto.
 */
export function resolvePermission(
  role: string,
  key: string,
  overrides: Record<string, boolean>,
): boolean {
  if (role === "ADMIN") return roleDefault("ADMIN", key);
  if (!permissionByKey(key)) return false;
  const override = overrides[key];
  return override ?? roleDefault(role, key);
}
