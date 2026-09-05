import { Info } from "lucide-react";
import { GRIEVANCE_OFFICER } from "@/lib/dpdp";

/**
 * Shown to a grower when a permission has been withdrawn from their account.
 *
 * The gate itself lives on the server; this exists so the portal does not go
 * quietly strange. A grower whose downloads were switched off would otherwise
 * tap a photograph, get nothing, and reasonably conclude the site was broken —
 * so the reason is on the page, with the number to ring about it.
 */
export function PermissionNotice({ what }: { what: string }) {
  return (
    <div className="flex gap-3 rounded-[--radius-card] border border-warning/40 bg-warning/8 p-4">
      <Info className="mt-0.5 size-4 shrink-0 text-warning" />
      <p className="text-sm leading-relaxed text-body">
        {what} is switched off for your account, so you can look but not save a
        copy. If that is not what you expected, call{" "}
        {GRIEVANCE_OFFICER.name.split(" ")[0]} on{" "}
        <a
          href={`tel:${GRIEVANCE_OFFICER.phone}`}
          className="underline hover:text-forest"
        >
          {GRIEVANCE_OFFICER.phoneDisplay}
        </a>
        .
      </p>
    </div>
  );
}
