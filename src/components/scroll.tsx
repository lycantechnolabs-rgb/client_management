"use client";

import {
  Children,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import {
  damp,
  mapRange,
  usePrefersReducedMotion,
  useScrollFrame,
  useScrollProgressRef,
  useScrollVar,
  useScrollVelocity,
} from "@/lib/scroll";

/* -------------------------------------------------------------------------- */
/* Reading progress                                                            */
/* -------------------------------------------------------------------------- */

/** Browser feature support never changes within a session, so nothing to watch. */
const noopSubscribe = () => () => {};

/**
 * A hairline at the top of the window showing how far down the page you are.
 * Uses the native scroll-driven animation where the browser has it — that runs
 * off the main thread — and falls back to the shared rAF ticker where it does
 * not.
 */
export function ReadingProgress() {
  const bar = useRef<HTMLDivElement>(null);
  // Support is a fact about the browser, not React state — reading it through
  // useSyncExternalStore keeps the server render (no native timeline, JS
  // fallback) and the client render from disagreeing during hydration.
  const native = useSyncExternalStore(
    noopSubscribe,
    () => CSS.supports("animation-timeline: scroll()"),
    () => false,
  );

  useScrollFrame(() => {
    const el = bar.current;
    if (!el) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    el.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  }, !native);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent"
      aria-hidden="true"
    >
      <div
        ref={bar}
        className={cn(
          "h-full origin-left bg-gradient-to-r from-moss to-sage",
          native ? "scroll-progress" : "scale-x-0",
        )}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Parallax                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Moves its children against the scroll. `speed` is in pixels of total travel
 * across the element's full pass through the viewport — negative moves with the
 * scroll, positive against it.
 */
export function Parallax({
  children,
  speed = 60,
  className,
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const inner = useRef<HTMLDivElement>(null);

  const host = useScrollProgressRef<HTMLDivElement>((p) => {
    const el = inner.current;
    if (!el) return;
    // Centred on 0.5 so the element sits at its authored position when it is in
    // the middle of the viewport, and is only displaced at the edges.
    el.style.transform = `translate3d(0, ${(0.5 - p) * speed}px, 0)`;
  });

  return (
    <div ref={host} className={className}>
      <div ref={inner} className="will-change-transform">
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Scrubbed headline                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A headline whose words rise into place as the block is scrolled through,
 * word by word rather than all at once.
 *
 * Each word carries its index; the actual animation is a CSS expression over
 * `--p` and `--i` (see `globals.css`). JavaScript supplies the clock and
 * nothing else, so scrubbing back up reverses it exactly.
 */
export function ScrubText({
  children,
  as = "h2",
  className,
}: {
  children: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
}) {
  const ref = useScrollVar<HTMLHeadingElement>("--p", "enter");
  const words = useMemo(() => children.split(/\s+/), [children]);
  const reduced = usePrefersReducedMotion();

  // Narrowed to one concrete tag rather than widened to `ElementType`: resolving
  // `ref` against every intrinsic element at once is a union TypeScript refuses
  // to build. All four allowed tags take the same props at runtime.
  const Tag = as as "h2";

  return (
    <Tag
      ref={ref}
      className={cn("scrub-text", className)}
      style={{ "--n": words.length } as React.CSSProperties}
    >
      {/* The separating space has to sit *between* the word wrappers, not
          inside them. .scrub-word-outer is an inline-block, and trailing
          whitespace inside an inline-block is trimmed off the box — which ran
          every scrubbed heading on the site together into one word. */}
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <span className="scrub-word-outer">
            <span
              className={reduced ? undefined : "scrub-word"}
              style={{ "--i": i } as React.CSSProperties}
            >
              {word}
            </span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </Tag>
  );
}

/* -------------------------------------------------------------------------- */
/* Marquee                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A band of text that drifts on its own and is shoved along by the page's
 * scroll velocity — it speeds up when you scroll down, and runs backwards when
 * you scroll up.
 */
export function Marquee({
  children,
  baseSpeed = 0.35,
  className,
}: {
  children: ReactNode;
  baseSpeed?: number;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const boost = useRef(0);
  const reduced = usePrefersReducedMotion();

  useScrollVelocity((v) => {
    boost.current = v;
  });

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 16.67, 3);
      last = now;

      const el = track.current;
      if (el) {
        offset.current -= (baseSpeed + boost.current * 0.35) * dt;
        // The track holds the content twice; wrapping at half its width makes
        // the loop seamless in both directions.
        const half = el.scrollWidth / 2;
        if (half > 0) {
          if (offset.current <= -half) offset.current += half;
          if (offset.current > 0) offset.current -= half;
        }
        el.style.transform = `translate3d(${offset.current}px, 0, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [baseSpeed, reduced]);

  return (
    <div className={cn("overflow-hidden", className)} aria-hidden="true">
      <div ref={track} className="flex w-max will-change-transform">
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0">{children}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tilt                                                                        */
/* -------------------------------------------------------------------------- */

/** Card that turns in 3D toward the pointer, with a light sweep that follows it. */
export function TiltCard({
  children,
  className,
  strength = 8,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const box = el.getBoundingClientRect();
        const x = (e.clientX - box.left) / box.width;
        const y = (e.clientY - box.top) / box.height;
        el.style.setProperty("--tilt-x", `${(0.5 - y) * strength}deg`);
        el.style.setProperty("--tilt-y", `${(x - 0.5) * strength}deg`);
        el.style.setProperty("--glare-x", `${x * 100}%`);
        el.style.setProperty("--glare-y", `${y * 100}%`);
      });
    };

    const onLeave = () => {
      cancelAnimationFrame(raf);
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [reduced, strength]);

  return (
    <div ref={ref} className={cn("tilt-card", className)}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Magnetic                                                                    */
/* -------------------------------------------------------------------------- */

/** Wraps a control so it leans toward an approaching cursor. */
export function Magnetic({
  children,
  radius = 90,
  pull = 0.28,
  className,
}: {
  children: ReactNode;
  radius?: number;
  pull?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const state = { x: 0, y: 0, tx: 0, ty: 0 };
    let raf = 0;
    let last = performance.now();

    const onMove = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height / 2);
      const distance = Math.hypot(dx, dy);
      const reach = radius + Math.max(box.width, box.height) / 2;

      if (distance < reach) {
        state.tx = dx * pull;
        state.ty = dy * pull;
      } else {
        state.tx = 0;
        state.ty = 0;
      }
    };

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      state.x = damp(state.x, state.tx, 0.0001, dt);
      state.y = damp(state.y, state.ty, 0.0001, dt);
      el.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [radius, pull, reduced]);

  return (
    <span ref={ref} className={cn("inline-block will-change-transform", className)}>
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Horizontal rail                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Turns vertical scroll into horizontal travel across a pinned row.
 *
 * The section is made tall enough that the row has somewhere to travel, and the
 * row is translated by the exact overflow — so the last card lands flush at the
 * right edge no matter how many there are or how wide the window is.
 */
export function HorizontalRail({
  children,
  className,
  heading,
}: {
  children: ReactNode;
  className?: string;
  heading?: ReactNode;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [travel, setTravel] = useState(0);
  const [pin, setPin] = useState(false);
  const reduced = usePrefersReducedMotion();

  // Hijacking the scroll direction is only worth it on a wide pointer-driven
  // screen. On a phone a thumb already swipes sideways perfectly well, and
  // pinning the page there just makes the section feel stuck.
  useEffect(() => {
    if (reduced) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setPin(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [reduced]);

  useEffect(() => {
    const el = rail.current;
    if (!el || !pin) return;
    const measure = () => setTravel(Math.max(0, el.scrollWidth - el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, pin]);

  const host = useScrollProgressRef<HTMLDivElement>((p) => {
    const el = rail.current;
    if (!el || !pin) return;
    el.style.transform = `translate3d(${-p * travel}px, 0, 0)`;
  }, "pin");

  if (!pin) {
    return (
      <section className={className}>
        {heading}
        {/* No negative margin here: the section has no padding of its own to
            cancel, and a -mx would push the strip past the viewport and give
            the whole page a horizontal scrollbar. */}
        <div className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 sm:px-6">
          {children}
        </div>
      </section>
    );
  }

  return (
    <div
      ref={host}
      className={className}
      style={{ height: `calc(100vh + ${travel}px)` }}
    >
      <div className="sticky top-0 flex h-dvh flex-col justify-center overflow-hidden">
        {heading}
        <div
          ref={rail}
          className="flex gap-5 px-4 will-change-transform sm:gap-7 sm:px-6"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sticky stack                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Cards that pile up: each one sticks under the header while the next slides
 * over it, shrinking and dimming slightly as it goes under.
 */
export function StickyStack({
  children,
  className,
  offset = 96,
  step = 14,
}: {
  children: ReactNode;
  className?: string;
  /** Distance from the top of the viewport the first card sticks at. */
  offset?: number;
  /** How far each subsequent card is inset below the last. */
  step?: number;
}) {
  const items = Children.toArray(children);

  return (
    <div className={cn("relative", className)}>
      {items.map((child, i) => (
        <StackItem
          key={i}
          index={i}
          total={items.length}
          offset={offset}
          step={step}
        >
          {child}
        </StackItem>
      ))}
    </div>
  );
}

function StackItem({
  children,
  index,
  total,
  offset,
  step,
}: {
  children: ReactNode;
  index: number;
  total: number;
  offset: number;
  step: number;
}) {
  const inner = useRef<HTMLDivElement>(null);

  const host = useScrollProgressRef<HTMLDivElement>((p) => {
    const el = inner.current;
    if (!el) return;
    // Only the tail of the pass matters: the card is untouched until it is
    // actually pinned and being covered by the one after it.
    const covered = mapRange(p, 0.55, 1, 0, 1);
    const remaining = total - 1 - index;
    if (remaining <= 0) return;
    el.style.transform = `scale(${1 - covered * 0.06})`;
    el.style.opacity = `${1 - covered * 0.35}`;
  }, "cover");

  return (
    <div
      ref={host}
      className="sticky"
      style={{
        top: offset + index * step,
        // Trailing space so the last card is not left flush against the next
        // section the instant it lands.
        marginBottom: index === total - 1 ? 0 : 24,
        zIndex: index + 1,
      }}
    >
      <div ref={inner} className="origin-top will-change-transform">
        {children}
      </div>
    </div>
  );
}
