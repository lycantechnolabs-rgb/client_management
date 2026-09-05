"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/* -------------------------------------------------------------------------- */
/* One ticker for the whole page                                              */
/* -------------------------------------------------------------------------- */

/**
 * Every scroll-driven component on the page reads from a single rAF loop
 * instead of attaching its own scroll listener. With a dozen parallax layers
 * and a pinned 3D scene running at once, separate listeners would each force
 * their own layout read per event; batching them into one frame keeps the
 * whole page on one layout pass.
 */
type Frame = (scrollY: number, viewportH: number) => void;

const frames = new Set<Frame>();
let rafId = 0;
let attached = false;

function run() {
  rafId = 0;
  const y = window.scrollY;
  const h = window.innerHeight;
  for (const f of frames) f(y, h);
}

function schedule() {
  if (!rafId) rafId = requestAnimationFrame(run);
}

function attach() {
  if (attached) return;
  attached = true;
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
}

function detach() {
  if (!attached || frames.size) return;
  attached = false;
  window.removeEventListener("scroll", schedule);
  window.removeEventListener("resize", schedule);
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

/** Subscribe to the shared scroll frame. The callback runs at most once a frame. */
export function useScrollFrame(fn: Frame, enabled = true) {
  // The callback is kept in a ref and refreshed after each render, so the
  // subscription below is set up once and never torn down just because the
  // caller passed a new closure.
  const saved = useRef(fn);
  useEffect(() => {
    saved.current = fn;
  });

  useEffect(() => {
    if (!enabled) return;
    const f: Frame = (y, h) => saved.current(y, h);
    frames.add(f);
    attach();
    schedule();
    return () => {
      frames.delete(f);
      detach();
    };
  }, [enabled]);
}

/* -------------------------------------------------------------------------- */
/* Motion preference                                                          */
/* -------------------------------------------------------------------------- */

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void) {
  const mq = window.matchMedia(MOTION_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  );
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */

export type ScrollRange =
  /** 0 as the top edge enters the viewport bottom, 1 as the bottom edge leaves the top. */
  | "cover"
  /** 0 as the top edge enters the viewport bottom, 1 once the element is fully in view. */
  | "enter"
  /** 0 when the element's top reaches the viewport top, 1 when its bottom does. Use on tall pinned sections. */
  | "pin";

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

function measure(rect: DOMRect, viewportH: number, range: ScrollRange) {
  if (range === "pin") {
    const travel = rect.height - viewportH;
    if (travel <= 0) return rect.top <= 0 ? 1 : 0;
    return clamp01(-rect.top / travel);
  }
  if (range === "enter") {
    const travel = viewportH + Math.min(rect.height, viewportH);
    return clamp01((viewportH - rect.top) / travel);
  }
  return clamp01((viewportH - rect.top) / (viewportH + rect.height));
}

/**
 * Scroll progress as a plain number, written straight to the DOM every frame.
 *
 * Nothing here goes through React state: a pinned section can be scrubbed for
 * several thousand pixels, and re-rendering the tree on each of those frames is
 * what makes scroll-driven pages stutter. Callers get the value and write it to
 * a style, a CSS custom property or a WebGL uniform themselves.
 */
export function useScrollProgressRef<T extends HTMLElement>(
  onProgress: (p: number) => void,
  range: ScrollRange = "cover",
) {
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();
  const saved = useRef(onProgress);
  useEffect(() => {
    saved.current = onProgress;
  });

  useEffect(() => {
    // Motion is off: jump straight to the finished state so nothing is left
    // half-revealed at the top of its range.
    if (reduced) saved.current(1);
  }, [reduced]);

  useScrollFrame((_, h) => {
    const el = ref.current;
    if (!el) return;
    saved.current(measure(el.getBoundingClientRect(), h, range));
  }, !reduced);

  return ref;
}

/**
 * Scroll progress as React state, quantised to `steps` so a component only
 * re-renders when the value moves visibly. Use for things that must change the
 * tree (an active index, a label); use the ref version for pure transforms.
 */
export function useScrollProgress<T extends HTMLElement>(
  range: ScrollRange = "cover",
  steps = 100,
) {
  const [progress, setProgress] = useState(0);
  const last = useRef(-1);

  const ref = useScrollProgressRef<T>((p) => {
    const q = Math.round(p * steps) / steps;
    if (q !== last.current) {
      last.current = q;
      setProgress(q);
    }
  }, range);

  return { ref, progress };
}

/**
 * Writes scroll progress into a CSS custom property on the element itself, so
 * the animation can be expressed in CSS while JavaScript only supplies the
 * clock. Style with `calc()` against `var(--p)`.
 */
export function useScrollVar<T extends HTMLElement>(
  name = "--p",
  range: ScrollRange = "cover",
) {
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) write(ref.current, name, 1);
  }, [reduced, name]);

  useScrollFrame((_, h) => {
    const el = ref.current;
    if (!el) return;
    write(el, name, measure(el.getBoundingClientRect(), h, range));
  }, !reduced);

  return ref;
}

/**
 * Writes the value, and marks the element as being driven.
 *
 * The marker is what CSS keys the animation off. Until it appears the element
 * styles as if there were no animation at all — which is what a crawler, a
 * visitor with JavaScript off, and a tab that was opened in the background and
 * never composited a frame all see. Without it, a headline animating up from
 * `opacity: 0` would simply be missing for them.
 */
function write(el: HTMLElement | null, name: string, value: number) {
  if (!el) return;
  el.style.setProperty(name, value.toFixed(4));
  if (!el.hasAttribute("data-scroll-var")) {
    el.setAttribute("data-scroll-var", "");
  }
}

/* -------------------------------------------------------------------------- */
/* Easing and interpolation                                                   */
/* -------------------------------------------------------------------------- */

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Maps `p` from [inA, inB] onto [outA, outB], clamped at both ends. */
export function mapRange(
  p: number,
  inA: number,
  inB: number,
  outA: number,
  outB: number,
) {
  if (inB === inA) return outA;
  return lerp(outA, outB, clamp01((p - inA) / (inB - inA)));
}

/** Frame-rate-independent damping, for values that should chase rather than snap. */
export function damp(current: number, target: number, smoothing: number, dt: number) {
  return lerp(current, target, 1 - Math.pow(smoothing, dt));
}

/* -------------------------------------------------------------------------- */
/* In-view                                                                    */
/* -------------------------------------------------------------------------- */

export function useInView<T extends HTMLElement>(
  { once = true, threshold = 0.15, margin = "0px 0px -40px 0px" } = {},
) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, threshold, margin]);

  return { ref, inView };
}

/** Scroll velocity in px/frame, damped back to zero when the page settles. */
export function useScrollVelocity(onChange: (v: number) => void) {
  const last = useRef(0);
  const velocity = useRef(0);
  const saved = useRef(onChange);
  useEffect(() => {
    saved.current = onChange;
  });

  const tick = useCallback((y: number) => {
    velocity.current = damp(velocity.current, y - last.current, 0.001, 1 / 60);
    last.current = y;
    saved.current(velocity.current);
  }, []);

  useScrollFrame(tick);
}
