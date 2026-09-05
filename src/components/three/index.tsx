import { STAGES } from "./stages";
import { Reveal } from "@/components/motion";

/**
 * The scrubbed pod journey used to be a pinned 3D scene. It's gone — this is
 * the flat stack of stages that used to be its low-end/reduced-motion
 * fallback, promoted to the only version.
 */
export function PodJourney() {
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
