import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight,
  Camera,
  FileText,
  Images,
  IndianRupee,
  Lock,
  Scale,
  Smartphone,
  Sprout,
} from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { PhoneFrame, Reveal } from "@/components/motion";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Every visit to your estate is photographed, costed and logged the same day — and appears in your own private portal.",
};

const SCREENS = [
  {
    icon: Sprout,
    title: "The work log",
    text: "Every visit, newest first. What was done, on which plot, on what date — with the photographs from that day attached. Filter by type or by season.",
  },
  {
    icon: Images,
    title: "Photos and video",
    text: "Everything we shoot on your estate, in one gallery, dated and captioned. Nothing expires, nothing scrolls away.",
  },
  {
    icon: IndianRupee,
    title: "Costs",
    text: "What has been spent on your land this season — materials, labour and wages, broken down by category and by month.",
  },
  {
    icon: Scale,
    title: "Harvest",
    text: "Every picking round with green weight, dried weight and the grade the lot made. The season totals itself as it goes.",
  },
  {
    icon: FileText,
    title: "Inputs & documents",
    text: "The full fertilizer and spray record, plus lab reports, receipts and licences — the paperwork buyers and certifiers ask for.",
  },
  {
    icon: Lock,
    title: "Private to you",
    text: "Your login shows your estates and nothing else. No other grower can see your records, and you cannot see theirs.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-4 pt-14 sm:px-6">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
            How it works
          </p>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] text-forest sm:text-5xl">
            You should not have to take our word for it
          </h1>
          <p className="mt-5 leading-relaxed text-body">
            The hardest part of handing your estate to someone else is not
            knowing what actually happens on it. So we built the answer into how
            we work: nothing is done on your land without a record of it reaching
            you.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <Reveal>
          <div className="relative aspect-[16/9] overflow-hidden rounded-[--radius-card] bg-tint">
            <Image
              src="/photos/estate-morning.webp"
              alt="Morning light through the shade canopy over a cardamom plantation"
              fill
              priority
              sizes="(max-width: 1152px) 100vw, 1088px"
              className="object-cover"
            />
          </div>
        </Reveal>
      </section>

      {/* The day of a visit */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:gap-16">
          <ol className="space-y-8">
            {[
              {
                icon: Sprout,
                t: "Morning — the work happens",
                d: "A fertilizer round, a spray, a picking round, shade lopping. Whatever the estate needs that week, with the labour it takes.",
              },
              {
                icon: Camera,
                t: "On the spot — it is recorded",
                d: "Photographs and video from the plot itself. The materials used, by name and quantity. The workers present and their wages. Entered from the field, before we leave your land.",
              },
              {
                icon: Smartphone,
                t: "The same day — it reaches you",
                d: "It appears in your portal. You open it on your phone, wherever you are, and see the work and the proof of it together.",
              },
            ].map((s, i) => (
              <Reveal key={s.t} as="li" delay={i * 90}>
                <div className="flex gap-5">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-tint text-forest">
                    <s.icon className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-xl text-forest">{s.t}</h2>
                    <p className="mt-2 max-w-lg leading-relaxed text-body">
                      {s.d}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={140} className="lg:sticky lg:top-28 lg:self-start">
            <PhoneFrame>
              <div className="p-3.5 text-[11px]">
                <p className="font-display text-sm text-forest">
                  Harvest — 4th round
                </p>
                <p className="text-[10px] text-muted">
                  12 February · Upper block
                </p>

                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded bg-tint" />
                  ))}
                </div>

                <div className="mt-3 space-y-1.5">
                  {[
                    ["Green weight", "58 kg"],
                    ["Workers", "6 · ₹4,200"],
                    ["Grade", "AGEB"],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between rounded-lg border border-line bg-surface px-2.5 py-1.5"
                    >
                      <span className="text-muted">{k}</span>
                      <span className="font-medium text-forest">{v}</span>
                    </div>
                  ))}
                </div>

                <p className="mt-3 rounded-lg bg-tint/60 p-2.5 leading-relaxed text-body">
                  Capsules well filled on the upper block. Next round due around
                  the 25th.
                </p>
              </div>
            </PhoneFrame>
          </Reveal>
        </div>
      </section>

      {/* What is in the portal */}
      <section className="contoured wash-warm border-y border-line bg-cream-deep">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal className="max-w-2xl">
            <h2 className="font-display text-3xl leading-tight text-forest sm:text-4xl">
              What you can see in your portal
            </h2>
            <p className="mt-4 leading-relaxed text-body">
              Six things, all of them yours, all of them kept for as long as we
              work together.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SCREENS.map((s, i) => (
              <Reveal key={s.title} delay={i * 60}>
                <div className="group h-full rounded-[--radius-card] border border-line bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-moss/40 hover:shadow-lg hover:shadow-forest/5">
                  <span className="grid size-10 place-items-center rounded-xl bg-tint text-forest transition-colors group-hover:bg-moss group-hover:text-cream">
                    <s.icon className="size-4.5" />
                  </span>
                  <h3 className="mt-4 font-display text-lg text-forest">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-body">
                    {s.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Reassurance */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Reveal>
          <h2 className="text-center font-display text-3xl leading-tight text-forest sm:text-4xl">
            Common questions
          </h2>
          <dl className="mt-10 divide-y divide-line">
            {[
              [
                "Do I need to install anything?",
                "No. It opens in the browser on your phone, exactly like a website. We give you a link and a password.",
              ],
              [
                "Can other growers see my estate?",
                "No. Your login is tied to your estates alone. Nobody else can open your records, and you cannot open theirs.",
              ],
              [
                "What if I am not comfortable with phones?",
                "Then call us as you always would — the portal is there in addition, not instead. Many growers have a son or daughter check it for them.",
              ],
              [
                "Can I download my records?",
                "Yes. The season's input log, harvest record and costs can all be taken out as a document you keep.",
              ],
            ].map(([q, a]) => (
              <div key={q} className="py-5">
                <dt className="font-medium text-forest">{q}</dt>
                <dd className="mt-1.5 leading-relaxed text-body">{a}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <Reveal>
          <div className="rounded-[--radius-card] border border-line bg-surface px-6 py-14 text-center sm:px-12">
            <h2 className="mx-auto max-w-xl font-display text-3xl leading-tight text-forest sm:text-4xl">
              See it with your own estate in it
            </h2>
            <p className="mx-auto mt-4 max-w-md leading-relaxed text-body">
              Talk to us, and we will set up your portal from the first visit
              onward.
            </p>
            <ButtonLink href="/contact" size="lg" className="mt-8 rounded-xl">
              Get in touch <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </Reveal>
      </section>
    </>
  );
}
