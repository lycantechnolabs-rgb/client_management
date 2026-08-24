"use client";

import dynamic from "next/dynamic";
import { STAGES } from "./stages";
import { useCanRender3D } from "@/lib/scroll";
import { Reveal } from "@/components/motion";

/**
 * three.js is roughly 150 KB gzipped before anything of ours is added. It is
 * loaded only in the browser, only after the page is interactive, and only on
 * devices that passed the capability check — never on the server, never on a
 * phone that has told us it is saving data.
 */
const CardamomCanvas = dynamic(() => import("./cardamom-canvas"), {
  ssr: false,
});

const PodStagesScene = dynamic(() => import("./pod-stages"), {
  ssr: false,
  loading: () => <PodJourneyFlat />,
});

/* -------------------------------------------------------------------------- */
/* Hero backdrop                                                               */
/* -------------------------------------------------------------------------- */

export function HeroPods({ className }: { className?: string }) {
  const can3D = useCanRender3D();
  if (!can3D) return null;
  return <CardamomCanvas className={className} />;
}

/* -------------------------------------------------------------------------- */
/* The scrubbed pod journey, and its flat twin                                 */
/* -------------------------------------------------------------------------- */

export function PodJourney() {
  const can3D = useCanRender3D();
  return can3D ? <PodStagesScene /> : <PodJourneyFlat />;
}

/**
 * Same story, no WebGL: the pinned scrub becomes an ordinary stack of stages.
 * This is what a low-end phone, a reduced-motion setting or a data-saver
 * connection gets, and it has to stand on its own — the copy is the content,
 * the pods were only ever the illustration.
 */
function PodJourneyFlat() {
  return (
    <section className="bg-forest">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sage">
          One pod, four stages
        </p>
        <h2 className="mt-3 max-w-xl font-display text-3xl leading-tight text-cream sm:text-4xl">
          From the runner on the ground to a graded kilo
        </h2>

        <ol className="mt-12 grid gap-8 sm:grid-cols-2">
          {STAGES.map((s, i) => (
            <Reveal key={s.label} as="li" delay={i * 80}>
              <div className="h-full border-t border-cream/15 pt-5">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-sm text-sage">
                    0{i + 1}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-cream/50">
                    {s.label}
                  </span>
                </div>
                <h3 className="mt-3 font-display text-xl text-cream sm:text-2xl">
                  {s.title}
                </h3>
                <p className="mt-3 leading-relaxed text-cream/70">{s.text}</p>
                <p className="mt-4 text-sm text-sage">{s.metric}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
