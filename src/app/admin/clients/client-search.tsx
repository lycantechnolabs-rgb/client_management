"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

/**
 * Search across the client list.
 *
 * Typing updates the URL rather than filtering in the browser, so the result is
 * a real page Jinto can bookmark or send to himself, and the filtering happens
 * in the database — the list is small today but it is the list that grows with
 * the business, and a client-side filter would quietly stop working at the size
 * where searching starts to matter.
 *
 * Debounced because each keystroke is a round trip, and replace() rather than
 * push() so a search does not bury the previous page in the back history.
 */
export function ClientSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);
  const first = useRef(true);

  useEffect(() => {
    // Skip the run on mount, which would otherwise replace the URL with an
    // identical one before the user has typed anything.
    if (first.current) {
      first.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      const query = next.toString();
      router.replace(query ? `/admin/clients?${query}` : "/admin/clients");
    }, 250);

    return () => clearTimeout(timer);
  }, [value, params, router]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Name, code, village or phone"
        aria-label="Search clients"
        className="min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 ps-10 pe-10 text-base text-ink placeholder:text-muted/60 focus:border-moss focus:outline-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Clear search"
          className="absolute end-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-forest"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
