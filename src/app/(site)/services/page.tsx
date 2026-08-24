import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { Reveal } from "@/components/motion";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Full-season cardamom estate management in Idukki — nutrition, plant protection, shade, irrigation, harvest, curing and grading, all recorded and costed.",
};

const GROUPS = [
  {
    season: "Apr — Jun",
    phase: "Before the rains",
    items: [
      "Shade regulation and lopping ahead of the monsoon",
      "Gap filling and replanting of weak clumps",
      "Base manuring and soil correction",
      "Trench and drainage clearing",
    ],
  },
  {
    season: "Jun — Sep",
    phase: "Growth and flowering",
    items: [
      "Fertilizer rounds by schedule, recorded by dose",
      "Plant protection against thrips, borers and rot",
      "Weeding and mulching",
      "Panicle inspection and field notes",
    ],
  },
  {
    season: "Aug — Feb",
    phase: "Harvest",
    items: [
      "Picking rounds at 40–45 day intervals",
      "Green weight recorded at every round",
      "Curing house firing and moisture control",
      "Grading, weighing and packing",
    ],
  },
  {
    season: "All year",
    phase: "Running the estate",
    items: [
      "Labour engagement, attendance and wages",
      "Irrigation through dry spells",
      "Input purchase and cost recording",
      "Photo and video record of every visit",
    ],
  },
];

export default function ServicesPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-4 pt-14 sm:px-6">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
            Services
          </p>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] text-forest sm:text-5xl">
            Everything an estate needs, through the whole year
          </h1>
          <p className="mt-5 leading-relaxed text-body">
            We take on the running of your cardamom estate — the field work, the
            labour, the inputs, the harvest and the curing. What makes it
            different is not the work itself. It is that you can see all of it,
            as it happens, from wherever you are.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2">
          {GROUPS.map((g, i) => (
            <Reveal key={g.phase} delay={i * 80}>
              <div className="h-full rounded-[--radius-card] border border-line bg-surface p-7 transition-all duration-300 hover:border-moss/40 hover:shadow-lg hover:shadow-forest/5">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-xl text-forest">
                    {g.phase}
                  </h2>
                  <span className="shrink-0 rounded-full bg-tint px-3 py-1 text-[11px] font-medium tracking-wide text-forest">
                    {g.season}
                  </span>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {g.items.map((it) => (
                    <li
                      key={it}
                      className="flex gap-2.5 text-sm leading-relaxed text-body"
                    >
                      <Check className="mt-0.5 size-4 shrink-0 text-moss" />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="contoured wash-cool border-y border-line bg-cream-deep">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal className="max-w-2xl">
            <h2 className="font-display text-3xl leading-tight text-forest sm:text-4xl">
              What you get at the end of a season
            </h2>
            <p className="mt-4 leading-relaxed text-body">
              Not a verbal summary. A record — complete, dated and yours to keep.
            </p>
          </Reveal>

          <div className="mt-9 grid gap-5 sm:grid-cols-3">
            {[
              {
                t: "A full input log",
                d: "Every fertilizer and spray applied, with product name, quantity and date. The document buyers and certifiers ask for.",
              },
              {
                t: "Harvest and grading",
                d: "Green and dried weight for every round, with the grade each lot made.",
              },
              {
                t: "A costed account",
                d: "Materials, labour and wages itemised — what was spent on your land, and on what.",
              },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i * 80}>
                <div className="h-full rounded-[--radius-card] border border-line bg-surface p-6">
                  <h3 className="font-display text-lg text-forest">{c.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-body">
                    {c.d}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal>
          <div className="rounded-[--radius-card] border border-line bg-surface px-6 py-14 text-center sm:px-12">
            <h2 className="mx-auto max-w-xl font-display text-3xl leading-tight text-forest sm:text-4xl">
              Every estate is different
            </h2>
            <p className="mx-auto mt-4 max-w-md leading-relaxed text-body">
              Age of the plants, altitude, shade, water. Tell us about your land
              and we will walk it with you before quoting anything.
            </p>
            <ButtonLink
              href="/contact"
              size="lg"
              className="mt-8 rounded-xl"
            >
              Arrange a visit <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </Reveal>
      </section>
    </>
  );
}
