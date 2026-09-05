import Link from "next/link";
import { NOTICE_VERSION, PURPOSES } from "@/lib/dpdp";

/**
 * The notice a person sees at the moment they hand over their data, and the
 * tick that records their agreement to it.
 *
 * s.5 wants the notice *with* the request for consent, not filed behind a
 * link — so the itemised list of what is collected and why is on screen, and
 * the policy link is there for the long version rather than instead of one.
 *
 * s.6 wants a clear affirmative action, so the box ships unticked and has no
 * `defaultChecked`. A pre-ticked box is not consent under this Act, and a
 * consent record generated from one is worth nothing.
 *
 * The version is submitted alongside the tick so the stored record says what
 * the person was actually shown, not merely that they agreed to something.
 */
export function ConsentNotice({
  purposeKey,
  className = "",
}: {
  purposeKey: string;
  className?: string;
}) {
  const purpose = PURPOSES.find((p) => p.key === purposeKey);
  if (!purpose) return null;

  return (
    <div
      className={`rounded-xl border border-line bg-tint/30 p-4 text-xs ${className}`}
    >
      <input type="hidden" name="noticeVersion" value={NOTICE_VERSION} />

      <p className="font-medium text-forest">
        What we do with what you have typed
      </p>

      <p className="mt-2 text-body">
        We use it for one thing: {purpose.label.toLowerCase()}. That means we
        keep:
      </p>

      <ul className="mt-2 space-y-1 text-muted">
        {purpose.data.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-muted">
        You can ask for a copy of it, ask us to correct it, or ask us to erase
        it — and you can take this permission back at any time, as easily as
        you are giving it now. The{" "}
        <Link href="/privacy" className="underline hover:text-forest">
          privacy notice
        </Link>{" "}
        explains how, who to complain to if we get it wrong, and how long we
        keep things.
      </p>

      <label className="mt-4 flex items-start gap-2.5 text-sm text-body">
        <input
          type="checkbox"
          name="dpdpConsent"
          value="yes"
          required
          className="mt-0.5 size-4 shrink-0 accent-forest"
        />
        <span>
          I have read the above and I agree to my details being used for this.
        </span>
      </label>
    </div>
  );
}
