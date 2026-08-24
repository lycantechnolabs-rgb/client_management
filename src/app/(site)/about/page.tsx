import Image from "next/image";
import { ButtonLink } from "@/components/ui";

export const metadata = {
  title: "About us",
  description:
    "A cardamom business in the hills of Idukki — growing our own, and managing estates for growers across Vandanmedu, Kumily and Nedumkandam.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-moss">
          Our story
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-forest sm:text-5xl">
          Cardamom, and the people who grow it
        </h1>
      </header>

      <div className="relative mt-9 aspect-[16/9] overflow-hidden rounded-[--radius-card] bg-tint">
        <Image
          src="/photos/harvest-bowl.webp"
          alt="Cardamom estate in Idukki"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 900px"
          className="object-cover"
        />
      </div>

      <div className="mt-10 max-w-2xl space-y-5 leading-relaxed text-body">
        <p>
          We work in the high ranges of Idukki, where cardamom has been grown
          for generations. Our own estate sits above three thousand feet, under
          silver oak shade, where the mist holds until mid-morning and the
          capsules ripen slowly. That slowness is the whole point — it is what
          gives Idukki cardamom its colour and its aroma.
        </p>

        <h2 className="pt-3 font-display text-2xl text-forest">
          Two sides to what we do
        </h2>
        <p>
          The first is our own harvest, which we cure, grade and sell direct.
          There is no auction floor and no middleman in between — you buy it
          from the people who picked it.
        </p>
        <p>
          The second is estate management. We look after cardamom holdings for
          growers across Vandanmedu, Kumily and Nedumkandam: fertilizer rounds,
          spraying, shade regulation, harvest and curing. Many of these growers
          live away from their land, and used to rely on word of mouth to know
          what was happening on it.
        </p>

        <h2 className="pt-3 font-display text-2xl text-forest">
          Everything on record
        </h2>
        <p>
          So we changed that. Every grower we work with gets a private
          dashboard. Every job we do on their estate goes on it the same day,
          with photographs — what was applied, how much it cost, who worked,
          what the harvest weighed and what it fetched.
        </p>
        <p>
          It also builds something quietly valuable: a complete, dated record of
          every input that has gone onto the crop. When a buyer or a certifying
          body asks, the answer is already written down.
        </p>
      </div>

      <div className="mt-11 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[2, 5, 8, 11].map((n) => (
          <div
            key={n}
            className="relative aspect-square overflow-hidden rounded-xl bg-tint"
          >
            <Image
              src={`/uploads/estate-${n}.svg`}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      <div className="mt-11 flex flex-wrap gap-3">
        <ButtonLink href="/store" size="lg">
          See what we have
        </ButtonLink>
        <ButtonLink href="/contact" variant="outline" size="lg">
          Talk to us about your estate
        </ButtonLink>
      </div>
    </div>
  );
}
