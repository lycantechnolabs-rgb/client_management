import Image from "next/image";
import { Card, CardBody } from "@/components/ui";

export const metadata = {
  title: "Quality & grades",
  description:
    "How we grade cardamom — Alleppey Green Extra Bold, Bold and Superior — and how it is cured and stored.",
};

const GRADES = [
  {
    code: "AGEB",
    name: "Alleppey Green Extra Bold",
    size: "8 mm and above",
    note: "Our largest capsules, deepest colour, highest oil. What our export buyers take.",
  },
  {
    code: "AGB",
    name: "Alleppey Green Bold",
    size: "7 mm",
    note: "The everyday premium grade — the same aroma, one size down.",
  },
  {
    code: "AGS",
    name: "Alleppey Green Superior",
    size: "6 mm",
    note: "Smaller capsules, full flavour. Good for grinding and masala.",
  },
];

const STEPS = [
  {
    title: "Picking",
    body: "Capsules are picked by hand at three-quarter maturity, in rounds every 30 to 40 days through the season. Picking too early costs colour; too late and the capsules split.",
  },
  {
    title: "Curing",
    body: "Into the curing house the same evening, held between 50 and 55 °C and turned through the night. Slow and low is what keeps the green.",
  },
  {
    title: "Grading",
    body: "Sorted by size over sieves, then hand-checked for colour and split capsules before packing.",
  },
  {
    title: "Storage",
    body: "Sealed in food-grade pouches, away from light and heat, and packed to order rather than held in stock.",
  },
];

export default function QualityPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-moss">
          Quality
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-forest sm:text-5xl">
          How we grade, and why it matters
        </h1>
        <p className="mt-4 leading-relaxed text-body">
          Cardamom is graded by the size of the capsule and the depth of its
          green. Bigger, greener capsules hold more volatile oil — which is
          simply another way of saying they smell and taste stronger.
        </p>
      </header>

      {/* Captioned rather than decorative: the page opens by saying grade is
          capsule size and colour, and these are the two moments where that is
          decided — where a capsule starts, and what a clump carries at picking. */}
      <div className="mt-9 grid gap-4 sm:grid-cols-2">
        <figure>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[--radius-card] bg-tint">
            <Image
              src="/photos/flower-detail.webp"
              alt="A cardamom flower open on the panicle, with green capsules forming beside it"
              fill
              sizes="(max-width: 640px) 100vw, 420px"
              className="object-cover"
            />
          </div>
          <figcaption className="mt-2 text-xs leading-relaxed text-muted">
            Every capsule begins as one of these. The flower is pollinated low on
            the panicle, and the capsule swells behind it over the weeks that
            follow.
          </figcaption>
        </figure>
        <figure>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[--radius-card] bg-tint">
            <Image
              src="/photos/panicle-harvest.webp"
              alt="The base of a cardamom clump, its panicles heavy with unripe green capsules"
              fill
              sizes="(max-width: 640px) 100vw, 420px"
              className="object-cover"
            />
          </div>
          <figcaption className="mt-2 text-xs leading-relaxed text-muted">
            Panicles run along the ground rather than upward, which is why
            picking is done by hand, bent low, and why the same clump is picked
            over and over across a season.
          </figcaption>
        </figure>
      </div>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-forest">Our grades</h2>
        <div className="mt-5 space-y-3">
          {GRADES.map((g) => (
            <Card key={g.code}>
              <CardBody className="sm:flex sm:items-center sm:gap-6">
                <div className="sm:w-40 sm:shrink-0">
                  <p className="font-display text-xl text-forest">{g.code}</p>
                  <p className="text-xs text-muted">{g.size}</p>
                </div>
                <div className="mt-2 sm:mt-0">
                  <p className="font-medium text-forest">{g.name}</p>
                  <p className="mt-0.5 text-sm text-body">{g.note}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-forest">
          From the plant to the pouch
        </h2>
        <ol className="mt-5 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-forest font-display text-sm text-cream">
                {i + 1}
              </span>
              <div>
                <h3 className="font-display text-lg text-forest">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-body">
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <Card className="border-moss/30 bg-tint/40">
          <CardBody>
            <h2 className="font-display text-xl text-forest">
              A record of every input
            </h2>
            <p className="mt-2 leading-relaxed text-body">
              For every estate we manage, we keep a dated log of every
              fertilizer and every spray applied — what it was, how much, and
              when. Growers can see it in their dashboard at any time, and it is
              there when a buyer asks what has gone onto the crop.
            </p>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
