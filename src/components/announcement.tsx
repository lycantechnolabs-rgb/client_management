import { Megaphone } from "lucide-react";

/**
 * The strip at the top of the public site, when there is something to say.
 *
 * Renders nothing at all when empty — not a collapsed element, not a zero-height
 * bar. An announcement is the exception rather than the norm, and a site that
 * reserves space for one it does not have looks like it failed to load
 * something.
 *
 * The text is plain and rendered as text: no dismiss button, no markup, no
 * link. A banner that can be dismissed has to remember it was dismissed, per
 * person, per announcement, and the state outlives the message — this is one
 * sentence that goes away when Jinto clears the field.
 */
export function Announcement({ text }: { text: string }) {
  const message = text.trim();
  if (!message) return null;

  return (
    <div className="bg-forest text-cream">
      <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-[13px] leading-snug sm:px-6 sm:text-sm">
        <Megaphone className="size-4 shrink-0" aria-hidden />
        {message}
      </p>
    </div>
  );
}
