"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * Mascot with a gentle idle float and a slight lean toward the cursor.
 *
 * Deliberately CSS/transform based rather than Rive: the supplied artwork is a
 * 3D render, not the ten riggable SVG parts the Rive pipeline assumes.
 * Vectorising it would lose the shading that makes it appealing. When the
 * character is re-rendered as separate transparent PNGs per limb, this
 * component can be swapped for <RiveComponent /> without touching the page.
 *
 * Decorative, so it is hidden from assistive tech, and all motion is dropped
 * under prefers-reduced-motion (handled globally in globals.css, plus the
 * pointer tracking is disabled here).
 */
export function Mascot({ priority = false }: { priority?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");
    if (reduced.matches || coarse.matches) return;

    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const box = el.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        // Clamped so it leans, never lurches.
        setTilt({
          x: Math.max(-1, Math.min(1, (e.clientX - cx) / (box.width * 1.6))),
          y: Math.max(-1, Math.min(1, (e.clientY - cy) / (box.height * 2.2))),
        });
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <div
        className="animate-breathe will-change-transform"
        style={{
          transform: `translate3d(${tilt.x * 14}px, ${tilt.y * 10}px, 0) rotate(${tilt.x * 2.5}deg)`,
          transition: "transform 400ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <Image
          src="/mascot-cutout.png"
          alt=""
          width={620}
          height={620}
          priority={priority}
          sizes="(max-width: 1024px) 70vw, 440px"
          className="h-auto w-full select-none drop-shadow-[0_18px_28px_rgba(46,74,28,0.16)]"
        />
      </div>

      {/* Soft contact shadow so it reads as standing, not floating */}
      <div className="mx-auto -mt-4 h-4 w-1/2 rounded-[50%] bg-forest/12 blur-md" />
    </div>
  );
}
