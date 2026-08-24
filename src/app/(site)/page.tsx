import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  ClipboardList,
  FileText,
  FlaskConical,
  IndianRupee,
  Leaf,
  LineChart,
  Lock,
  ShoppingBasket,
  Sprout,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import { ButtonLink } from "@/components/ui";
import { Counter, PhoneFrame, Reveal } from "@/components/motion";
import {
  HorizontalRail,
  Magnetic,
  Marquee,
  Parallax,
  ScrubText,
  StickyStack,
  TiltCard,
} from "@/components/scroll";
import { HeroPods, PodJourney } from "@/components/three";
import { CardamomYear, ToldVsSeen } from "@/components/showcase";
import { money } from "@/lib/utils";

const SERVICES = [
  {
    icon: Sprout,
    title: "Nutrition & spraying",
    text: "Fertilizer rounds, foliar feeds and plant protection, applied on schedule and recorded by name, dose and date.",
  },
  {
    icon: Leaf,
    title: "Shade & field care",
    text: "Shade regulation, weeding, mulching and irrigation through the dry months, so the plants go into flowering strong.",
  },
  {
    icon: ClipboardList,
    title: "Harvest & curing",
    text: "Picking rounds, curing house management and grading — green weight, dried weight and grade logged every round.",
  },
  {
    icon: Wallet,
    title: "Labour & costs",
    text: "Workers, wages and every rupee spent on your estate, itemised and visible to you as it happens.",
  },
  {
    icon: FlaskConical,
    title: "Soil & inputs",
    text: "Soil tests read properly, and a feeding plan built from them — not the same sack of fertilizer every estate gets.",
  },
  {
    icon: FileText,
    title: "Records you keep",
    text: "A season's worth of work you can filter, read and download — yours, and still there in five years.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "We visit your estate",
    text: "A scheduled round of work — feeding, spraying, shade, harvest, whatever the season calls for. You know before we come, and you know when we have been.",
  },
  {
    n: "02",
    title: "The work is recorded on the spot",
    text: "Photographs, videos, materials used, workers present and costs, entered from the field before we leave. Nothing written up from memory afterwards.",
  },
  {
    n: "03",
    title: "It appears in your portal",
    text: "You open your phone and see exactly what was done on your land that day, with the proof attached — wherever in the world you happen to be.",
  },
  {
    n: "04",
    title: "The season adds up",
    text: "Every input, every harvest, every rupee — one continuous record you can read, filter and download when the year closes.",
  },
];

const BAND = [
  "Fertilizer rounds",
  "Shade regulation",
  "Picking",
  "Curing",
  "Grading",
  "Soil tests",
  "Wages",
  "Photo proof",
];

export default async function HomePage() {
  // Real figures, aggregated across all estates. Nothing here identifies a
  // grower — individual records stay behind the login.
  const [plotCount, visitCount, photoCount, cured] = await Promise.all([
    db.plot.count({ where: { isActive: true } }),
    db.activity.count(),
    db.attachment.count({ where: { kind: "IMAGE" } }),
    db.activity.aggregate({ _sum: { driedWeightKg: true } }),
  ]);

  const featured = await db.product.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: { sortOrder: "asc" },
    take: 2,
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      variants: { orderBy: { price: "asc" }, take: 1 },
    },
  });

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Hero — 3D pods drift behind the type and clear away as you scroll   */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="glow-warm relative mx-auto max-w-[1400px] overflow-hidden rounded-[22px] border border-line/50 shadow-card sm:rounded-[28px]">
          {/* Decorative: the headline beside it carries the meaning, so it
              takes an empty alt rather than describing the hillside twice. */}
          <Image
            src="/photos/hero-pods.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover object-right"
          />
          {/* The scrim has to change direction with the layout. From lg up the
              copy sits in the image's empty left half, so a left-to-right wash
              is enough. Below that the hero stacks and the paragraph lands on
              top of the pods themselves, where a horizontal gradient protects
              nothing — so it runs top-to-bottom instead, lightest at the top of
              the frame and heaviest under the text. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-cream/25 via-cream/80 to-cream/92 lg:bg-gradient-to-r lg:from-cream lg:via-cream/70 lg:to-transparent"
          />

          {/* The WebGL layer is additive: if it never loads, the hero below is
              exactly the hero we had before.

              Hidden below lg. With the mascot gone the hero is a single column,
              so on a phone these drift straight across the headline and the
              paragraph — the type still wins on z-index, but mid-green pods
              behind dark green text is not a contrast anyone should have to
              read. There is a photograph of real pods behind them now anyway. */}
          <HeroPods className="pointer-events-none absolute inset-0 z-0 hidden lg:block" />

          <div className="relative flex min-h-[26rem] flex-col justify-center px-5 pb-16 pt-10 sm:px-8 sm:min-h-[30rem] lg:min-h-[34rem] lg:px-14 lg:pb-24 lg:pt-20">
            <div className="relative z-10 max-w-xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-moss/25 bg-surface/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-moss backdrop-blur-sm sm:text-xs">
                <Leaf className="size-3.5" />
                Cardamom estate management · Idukki
              </p>

              {/* No <br>: the headline is balanced by the browser now (see
                  text-wrap in globals.css), so it breaks evenly at whatever
                  width it gets instead of stranding "open" on its own line. */}
              <h1 className="mt-5 font-display text-[2.5rem] font-semibold leading-[1.03] text-forest sm:text-6xl lg:text-[4.2rem]">
                Your estate, managed in the open
              </h1>

              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-body sm:text-base">
                We run cardamom estates for growers across the Idukki hills — and
                we show you every day&apos;s work on your phone. Every fertilizer
                round, every harvest, every rupee. Nothing you have to take on
                trust.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Magnetic>
                  <ButtonLink href="/contact" size="lg" className="rounded-xl">
                    Talk to us <ArrowRight className="size-4" />
                  </ButtonLink>
                </Magnetic>
                <Magnetic>
                  <ButtonLink
                    href="/how-it-works"
                    variant="outline"
                    size="lg"
                    className="rounded-xl border-forest/30 bg-surface/70 backdrop-blur-sm"
                  >
                    See how it works
                  </ButtonLink>
                </Magnetic>
              </div>

              <ul className="mt-10 flex flex-wrap gap-2.5 text-sm text-body">
                <li className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-2">
                  <Camera className="size-4 text-moss" /> Photo proof
                </li>
                <li className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-2">
                  <IndianRupee className="size-4 text-moss" /> Costs you can see
                </li>
                <li className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-2">
                  <Lock className="size-4 text-moss" /> Private to you
                </li>
              </ul>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
            <span className="inline-flex items-center gap-2 text-xs text-forest/60">
              <span className="grid h-5 w-3 place-items-start rounded-full border border-forest/40 pt-1">
                <span className="mx-auto block size-1 animate-bounce rounded-full bg-forest/60" />
              </span>
              Scroll down
            </span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Marquee — drifts on its own, shoved along by scroll velocity        */}
      {/* ------------------------------------------------------------------ */}
      {/* Hairlines rather than solid borders: this band runs the full width of
          the window, and a hard rule edge to edge chops the page into stacked
          boxes. These dissolve at the margins. */}
      <div className="relative py-5">
        <hr className="hairline absolute inset-x-0 top-0" />
        <hr className="hairline absolute inset-x-0 bottom-0" />
        <Marquee className="fade-edges-x" baseSpeed={0.4}>
          {BAND.map((word) => (
            <span
              key={word}
              className="flex items-center gap-6 whitespace-nowrap px-6 font-display text-2xl text-forest/25 sm:text-3xl"
            >
              {word}
              <Leaf className="size-4 shrink-0 text-moss/40" />
            </span>
          ))}
        </Marquee>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Numbers                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <Reveal>
          <div className="overflow-hidden rounded-[--radius-card] border border-line bg-surface shadow-card">
            {/* Clay rather than moss: a live indicator is the one thing in this
                block that is not decorative, and against a page of greens the
                warm dot is what the eye finds first. */}
            <p className="flex items-center justify-center gap-2 border-b border-line-soft bg-cream-deep/60 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-clay">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-clay opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-clay" />
              </span>
              Live from the estates
            </p>
            <dl className="grid gap-px bg-line sm:grid-cols-4">
              {[
                { v: plotCount, label: "Plots under management" },
                { v: visitCount, label: "Visits logged and costed" },
                { v: photoCount, label: "Photographs filed" },
                {
                  v: Math.round(cured._sum.driedWeightKg ?? 0),
                  suffix: " kg",
                  label: "Cured this season",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-surface px-5 py-8 text-center transition-colors duration-300 hover:bg-cream-deep/50"
                >
                  <dt className="font-display text-4xl text-forest">
                    <Counter to={s.v} suffix={s.suffix ?? ""} />
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted">
                    {s.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* The problem / the difference                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="contoured wash-cool border-y border-line bg-cream-deep">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                Why growers move to us
              </p>
            </Reveal>

            <ScrubText className="mt-3 font-display text-3xl leading-tight text-forest sm:text-4xl">
              Most estate management ends with a phone call
            </ScrubText>

            <Reveal delay={60}>
              <p className="mt-4 leading-relaxed text-body">
                You are told the spraying is done. You are told the harvest came
                to so many kilos. If you live away from the estate — in Kochi, in
                the Gulf, anywhere but the hillside — you have no way to check,
                and no record at the end of the season.
              </p>
            </Reveal>
          </div>

          <Reveal delay={80} className="mt-10">
            <ToldVsSeen />
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* The pod journey — pinned, scroll-scrubbed 3D                        */}
      {/* ------------------------------------------------------------------ */}
      <PodJourney />

      {/* ------------------------------------------------------------------ */}
      {/* Services — vertical scroll drives a horizontal rail                 */}
      {/* ------------------------------------------------------------------ */}
      <HorizontalRail
        className="py-16"
        heading={
          <div className="mx-auto mb-9 w-full max-w-6xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
              What we do
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <h2 className="max-w-lg font-display text-3xl leading-tight text-forest sm:text-4xl">
                The whole year on your estate
              </h2>
              <Link
                href="/services"
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-clay hover:text-clay-600"
              >
                All services
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        }
      >
        {SERVICES.map((s) => (
          <TiltCard
            key={s.title}
            className="w-[78vw] shrink-0 snap-center rounded-[--radius-card] sm:w-[360px]"
          >
            <div className="group h-full rounded-[--radius-card] border border-line bg-surface p-7 shadow-card transition-shadow duration-300 hover:shadow-lift">
              {/* The icon chip warms on hover — the only colour change in the
                  card, so it reads as the card responding rather than as
                  decoration. */}
              <span className="grid size-11 place-items-center rounded-xl bg-tint text-forest transition-colors duration-300 group-hover:bg-clay/12 group-hover:text-clay">
                <s.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-display text-xl text-forest">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-body">{s.text}</p>
            </div>
          </TiltCard>
        ))}
      </HorizontalRail>

      {/* ------------------------------------------------------------------ */}
      {/* The cardamom year                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="contoured wash-warm border-y border-line bg-cream-deep">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-xl">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                The cardamom year
              </p>
            </Reveal>
            <ScrubText className="mt-3 font-display text-3xl leading-tight text-forest sm:text-4xl">
              Twelve months, and none of them idle
            </ScrubText>
          </div>

          <Reveal delay={100} className="mt-12">
            <CardamomYear />
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* The portal — the differentiator                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="leaf-mark relative overflow-hidden border-y border-line bg-forest">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-moss/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-20">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-honey-light">
              Your private portal
            </p>
            <h2 className="mt-3 font-display text-3xl leading-tight text-cream sm:text-4xl">
              Open your phone. See your estate.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-cream/75">
              Every grower we work with gets a private login. No app to install,
              nothing to learn — it opens in your browser and shows only your
              estates, only your records.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                {
                  icon: Camera,
                  t: "Photos and video from every visit",
                  d: "Dated, captioned and kept — not lost in a chat thread.",
                },
                {
                  icon: LineChart,
                  t: "Harvest and grading, round by round",
                  d: "Green weight, dried weight and grade for the whole season.",
                },
                {
                  icon: IndianRupee,
                  t: "Costs, itemised",
                  d: "Materials, labour and wages — what was spent and on what.",
                },
              ].map((f) => (
                <li key={f.t} className="flex gap-3.5">
                  <span className="glass-dark mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg text-honey-light">
                    <f.icon className="size-4" />
                  </span>
                  <div>
                    <p className="font-medium text-cream">{f.t}</p>
                    <p className="mt-0.5 text-sm text-cream/60">{f.d}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-wrap gap-3">
              <Magnetic>
                <ButtonLink
                  href="/how-it-works"
                  size="lg"
                  className="rounded-xl bg-cream text-forest hover:bg-cream-deep"
                >
                  See what you get <ArrowRight className="size-4" />
                </ButtonLink>
              </Magnetic>
              <ButtonLink
                href="/login"
                variant="outline"
                size="lg"
                className="rounded-xl border-cream/30 bg-transparent text-cream hover:bg-cream/10"
              >
                Client login
              </ButtonLink>
            </div>
          </Reveal>

          <Parallax speed={-70}>
            <PhoneFrame>
              <div className="space-y-3 p-3.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display text-sm text-forest">
                      Good morning
                    </p>
                    <p className="text-[10px] text-muted">Thomas Mathew</p>
                  </div>
                  <span className="rounded-full bg-tint px-2 py-0.5 text-[9px] text-forest">
                    2 estates
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-line bg-surface p-2.5">
                    <p className="text-[9px] text-muted">This season</p>
                    <p className="mt-0.5 font-display text-base text-forest">
                      ₹1,84,200
                    </p>
                    <p className="text-[9px] text-muted">spent</p>
                  </div>
                  <div className="rounded-lg border border-line bg-surface p-2.5">
                    <p className="text-[9px] text-muted">Dried</p>
                    <p className="mt-0.5 font-display text-base text-forest">
                      412 kg
                    </p>
                    <p className="text-[9px] text-muted">7 rounds</p>
                  </div>
                </div>

                <p className="pt-1 text-[9px] font-semibold uppercase tracking-wider text-moss">
                  Recent work
                </p>

                {[
                  { d: "12 Feb", t: "Harvest — 4th round", m: "58 kg green" },
                  { d: "04 Feb", t: "Fertilizer round", m: "Factomphos 50 kg" },
                  { d: "28 Jan", t: "Shade regulation", m: "3 workers" },
                ].map((a) => (
                  <div
                    key={a.d}
                    className="flex gap-2.5 rounded-lg border border-line bg-surface p-2.5"
                  >
                    <div className="size-9 shrink-0 rounded bg-tint" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-forest">{a.t}</p>
                      <p className="text-[10px] text-muted">
                        {a.d} · {a.m}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </PhoneFrame>
          </Parallax>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How it works — the four steps stack up as you scroll                */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <div className="max-w-xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
              How it works
            </p>
          </Reveal>
          <ScrubText className="mt-3 font-display text-3xl leading-tight text-forest sm:text-4xl">
            From the hillside to your hand, the same day
          </ScrubText>
        </div>

        <StickyStack className="mt-12" offset={110}>
          {STEPS.map((s) => (
            <article
              key={s.n}
              className="rounded-[--radius-card] border border-line bg-surface p-8 shadow-[0_18px_40px_-24px_rgba(46,74,28,0.35)] sm:p-10"
            >
              <div className="flex items-start gap-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-forest font-display text-sm text-cream">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-display text-xl text-forest sm:text-2xl">
                    {s.title}
                  </h3>
                  <p className="mt-2.5 leading-relaxed text-body">{s.text}</p>
                </div>
              </div>
            </article>
          ))}
        </StickyStack>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Store — secondary                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="wash-cool border-y border-line bg-cream-deep">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-lg">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                <ShoppingBasket className="size-3.5" />
                Also from us
              </p>
              <h2 className="mt-3 font-display text-3xl leading-tight text-forest sm:text-4xl">
                Buy our own harvest
              </h2>
              <p className="mt-3 leading-relaxed text-body">
                Alongside the estates we manage, we grow and cure cardamom of our
                own — graded on the estate and sold direct, at the price it
                deserves.
              </p>
            </div>
            <Link
              href="/store"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-moss hover:underline"
            >
              Visit the store <ArrowRight className="size-4" />
            </Link>
          </Reveal>

          <div className="mt-9 grid gap-5 sm:grid-cols-2">
            {featured.map((p, i) => (
              <Reveal key={p.id} delay={i * 80}>
                <TiltCard className="h-full rounded-[--radius-card]" strength={6}>
                  <Link
                    href={`/store/${p.slug}`}
                    className="group block h-full overflow-hidden rounded-[--radius-card] border border-line bg-surface"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-tint">
                      {p.images[0] ? (
                        <Image
                          src={p.images[0].url}
                          alt={p.name}
                          fill
                          sizes="(max-width: 640px) 100vw, 50vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      ) : null}
                    </div>
                    <div className="p-5">
                      <h3 className="font-display text-xl text-forest">
                        {p.name}
                      </h3>
                      <p className="mt-1.5 text-sm text-body">
                        {p.shortDescription}
                      </p>
                      <p className="mt-3 text-sm text-muted">
                        From{" "}
                        <span className="font-medium text-forest">
                          {money(p.variants[0]?.price ?? 0)}
                        </span>
                      </p>
                    </div>
                  </Link>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CTA                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[--radius-card] border border-line bg-surface px-6 py-14 text-center sm:px-12">
            <div
              className="pointer-events-none absolute inset-x-0 -top-20 mx-auto size-64 rounded-full bg-tint blur-3xl"
              aria-hidden="true"
            />
            <div className="relative">
              <h2 className="mx-auto max-w-xl font-display text-3xl leading-tight text-forest sm:text-4xl">
                Let&apos;s talk about your estate
              </h2>
              <p className="mx-auto mt-4 max-w-md leading-relaxed text-body">
                Tell us where your land is and what it needs. We will visit, walk
                it with you, and give you an honest plan for the season.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Magnetic>
                  <ButtonLink href="/contact" size="lg" className="rounded-xl">
                    Enquire now <ArrowRight className="size-4" />
                  </ButtonLink>
                </Magnetic>
                <ButtonLink
                  href="/services"
                  variant="outline"
                  size="lg"
                  className="rounded-xl"
                >
                  What we do
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
