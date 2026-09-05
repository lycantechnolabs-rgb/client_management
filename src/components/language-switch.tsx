"use client";

import { useOptimistic, useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import { setLocale } from "@/app/dashboard/settings/language-actions";

/**
 * English ⇄ മലയാളം, as a slide switch.
 *
 * A slider normally means on/off, and language is not on/off — so both labels
 * stay visible on the track and the knob slides between them. A bare toggle
 * would leave a grower guessing which side is theirs, which is precisely the
 * person this control exists for: someone who cannot read the label explaining
 * it. The word മലയാളം has to be on the screen, in its own script, before
 * anything is tapped.
 *
 * `useOptimistic` moves the knob on the tap rather than after the round trip.
 * The whole page re-renders in the new language when the action returns, and on
 * a hill connection that is a second or two of a switch that looks stuck.
 */
export function LanguageSwitch({
  current,
  size = "default",
  className,
}: {
  current: string;
  /** `compact` for the header, where it sits beside an avatar. */
  size?: "default" | "compact";
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [shown, setShown] = useOptimistic(current);
  const [failed, setFailed] = useState(false);

  const isMl = shown === "ml";
  const next = isMl ? "en" : "ml";

  /**
   * Change the language, and survive not being able to.
   *
   * The catch is not defensive padding. Without it a failed request escapes the
   * transition as an unhandled rejection and Next replaces the whole page with
   * an error — so a grower on a hill connection who taps this at the wrong
   * moment loses the screen they were reading, over a language toggle. The
   * optimistic state reverts on its own when the transition ends; what is
   * needed is to stop the throw and say something.
   *
   * The message is in both languages because at the moment it appears we do not
   * know which one they read: the switch is exactly the control they were using
   * to tell us.
   */
  const toggle = () => {
    if (pending) return;
    setFailed(false);
    start(async () => {
      setShown(next);
      try {
        const result = await setLocale(next);
        if (result && "error" in result && result.error) setFailed(true);
      } catch {
        setFailed(true);
      }
    });
  };

  const compact = size === "compact";

  return (
    <span className="inline-flex flex-col items-stretch gap-1">
      <button
        type="button"
        // `switch` rather than a plain button: it announces its state, and the
        // accessible name says what it switches between rather than "toggle".
        role="switch"
        aria-checked={isMl}
        aria-label="Language · ഭാഷ — English / മലയാളം"
        onClick={toggle}
        disabled={pending}
        className={cn(
          "relative inline-flex shrink-0 select-none items-center rounded-full border border-line bg-surface transition-colors disabled:opacity-60",
          // 44px tall even in the compact form: this is a control a thumb has to
          // find, and it sits next to other 44px targets in the header.
          compact ? "h-11 w-[8.5rem] text-xs" : "h-12 w-44 text-sm",
          className,
        )}
      >
        {/*
          The offset is an inline style rather than a utility class, deliberately.

          Tailwind v4's `translate-x-*` writes the CSS `translate` property, while
          `transition-transform` animates `transform` — two different properties,
          so the knob jumped rather than slid, and only on a client re-render did
          the mismatch show. Writing `transform` directly means the transition and
          the offset are talking about the same thing, in any Tailwind version.

          100% of its own width lands it against the right inset: the knob is half
          the track less the 0.25rem gap, so the two cancel.
        */}
        <span
          aria-hidden
          style={{ transform: isMl ? "translateX(100%)" : "translateX(0)" }}
          className={cn(
            "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-forest",
            "transition-transform duration-200 ease-out motion-reduce:transition-none",
          )}
        />

        {/* Both labels sit on the track, so which side is which is never a guess. */}
        <span
          lang="en"
          className={cn(
            "relative z-10 grid flex-1 place-items-center font-medium transition-colors",
            isMl ? "text-body" : "text-cream",
          )}
        >
          English
        </span>
        <span
          lang="ml"
          className={cn(
            "relative z-10 grid flex-1 place-items-center font-medium transition-colors",
            isMl ? "text-cream" : "text-body",
          )}
        >
          മലയാളം
        </span>
      </button>

      {failed ? (
        <span
          role="status"
          className="rounded-lg bg-danger/10 px-2 py-1 text-center text-[11px] leading-tight text-danger"
        >
          Could not change · മാറ്റാനായില്ല
        </span>
      ) : null}
    </span>
  );
}
