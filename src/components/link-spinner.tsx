"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A small spinner that only appears while the `<Link>` it sits inside is
 * navigating.
 *
 * `useLinkStatus` needs a client component descendant of the `<Link>`, which
 * is the only reason this is split out — the button and chip components that
 * render it stay server-friendly. Filters and pagination on the work log (and
 * anywhere else using ButtonLink or a filter chip) are ordinary navigations:
 * without this, clicking one gives no feedback until the new page finishes
 * loading, which is exactly what read as "did that even register?" lag.
 */
export function LinkPendingSpinner({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Loader2 className={cn("size-4 shrink-0 animate-spin", className)} />;
}
