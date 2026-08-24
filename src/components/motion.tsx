"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useInView, usePrefersReducedMotion } from "@/lib/scroll";

/** Fades and lifts its children into view on scroll. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  const on = inView || reduced;

  // Narrowed to one concrete tag rather than widened to `ElementType`: resolving
  // `ref` against every intrinsic element at once is a union TypeScript refuses
  // to build. All four allowed tags take the same props at runtime.
  const Tag = as as "div";

  return (
    <Tag
      ref={ref}
      data-reveal=""
      className={cn(
        "transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none",
        on ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
      style={{ transitionDelay: reduced ? "0ms" : `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/** Counts up to `to` when scrolled into view. */
export function Counter({
  to,
  suffix = "",
  prefix = "",
  decimals = 0,
  duration = 1400,
  className,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const reduced = usePrefersReducedMotion();
  // Start at the real figure so it is present in the server-rendered HTML for
  // crawlers and no-JS visitors. The count-up rewinds to zero only once the
  // element actually scrolls into view, which is the first time anyone sees it.
  const [value, setValue] = useState(to);

  useEffect(() => {
    if (!inView || reduced) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // ease-out cubic
      setValue(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration, reduced]);

  // With motion reduced, show the final figure straight away rather than
  // driving it through state.
  const shown = reduced ? to : value;

  return (
    <span ref={ref} className={className}>
      {prefix}
      {shown.toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/**
 * Phone frame used to show the grower's portal on the marketing pages.
 * Purely decorative chrome around real markup.
 */
export function PhoneFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[280px] rounded-[2.2rem] border-[10px] border-ink bg-ink shadow-2xl",
        className,
      )}
    >
      <div
        className="absolute left-1/2 top-0 z-10 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-ink"
        aria-hidden="true"
      />
      <div className="overflow-hidden rounded-[1.5rem] bg-cream">{children}</div>
    </div>
  );
}
