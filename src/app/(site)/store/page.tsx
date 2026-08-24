import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Leaf, Package, Sprout, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { money } from "@/lib/utils";
import { FREE_SHIPPING_ABOVE } from "@/lib/constants";
import { ButtonLink, EmptyState } from "@/components/ui";

export const metadata = {
  title: "Cardamom for sale",
  description:
    "Alleppey Green Extra Bold, Bold, seeds and ground cardamom — direct from our estate in Idukki.",
};

export default async function ProductsPage() {
  const products = await db.product.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      variants: { orderBy: { price: "asc" } },
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="max-w-2xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-moss/25 bg-tint/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-moss">
          <Leaf className="size-3.5" />
          Grown and cured by us · Idukki
        </p>
        <h1 className="mt-4 font-display text-4xl text-forest sm:text-5xl">
          Our cardamom
        </h1>
        <p className="mt-4 leading-relaxed text-body">
          Everything here comes from our own estate in Idukki, cured slowly to
          hold the colour and packed in small batches. Prices include GST.
        </p>
      </header>

      {/* The three things a first-time buyer actually wants to know before they
          scroll a price list. Real values, not decoration — the shipping
          threshold is the same constant the cart charges against. */}
      <ul className="mt-7 grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: Truck,
            title: `Free delivery over ${money(FREE_SHIPPING_ABOVE)}`,
            text: "Flat rate below that, anywhere in India.",
          },
          {
            icon: Package,
            title: "Packed in small batches",
            text: "Sealed after grading, not stored loose.",
          },
          {
            icon: Sprout,
            title: "Single estate",
            text: "One harvest, one place — no blending.",
          },
        ].map((f) => (
          <li
            key={f.title}
            className="flex items-start gap-3 rounded-[--radius-card] border border-line bg-surface/70 p-4"
          >
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-tint text-moss">
              <f.icon className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-medium text-forest">
                {f.title}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                {f.text}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {products.length === 0 ? (
        <div className="mt-10">
          <EmptyState title="Nothing in stock right now" />
        </div>
      ) : (
        /* Two up rather than three. With a four-product catalogue a
           three-column grid strands the last one alone on its own row, and the
           larger frame gives the illustrations room to be looked at. */
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {products.map((p) => {
            const inStock = p.variants.some((v) => v.stock > 0);
            const prices = p.variants.map((v) => v.price);
            const low = Math.min(...prices);
            const high = Math.max(...prices);

            return (
              <Link
                key={p.id}
                href={`/store/${p.slug}`}
                className="group flex flex-col overflow-hidden rounded-[--radius-card] border border-line bg-surface shadow-card transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-moss/50 hover:shadow-lift"
              >
                <div className="relative aspect-[5/4] overflow-hidden bg-tint">
                  {p.images[0] ? (
                    <Image
                      src={p.images[0].url}
                      alt={p.name}
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : null}
                  {!inStock ? (
                    <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-3 py-1 text-xs text-cream backdrop-blur-md">
                      Sold out
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <h2 className="font-display text-xl text-forest">{p.name}</h2>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-body">
                    {p.shortDescription}
                  </p>

                  {/* The actual pack sizes, rather than a "3 sizes" count. It
                      is the question the count provokes, and we already have
                      the answer loaded. */}
                  {p.variants.length > 0 ? (
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {p.variants.map((v) => (
                        <li
                          key={v.id}
                          className="rounded-full bg-tint px-2.5 py-1 text-[11px] font-medium text-forest"
                        >
                          {v.label}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-5 flex items-end justify-between border-t border-line-soft pt-4">
                    <span className="text-sm text-muted">
                      {/* The price is what a shopper actually scans the grid
                          for, so it carries the accent rather than sitting in
                          the same green as everything else. */}
                      <span className="font-display text-2xl text-clay">
                        {money(low)}
                      </span>
                      {high > low ? (
                        <span className="ml-1.5 text-xs">
                          – {money(high)}
                        </span>
                      ) : null}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-forest">
                      View
                      <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* The photograph behind this one was shot with the pile to the right
          and empty ground to the left, so the copy sits in space the image
          already left for it rather than fighting the subject. */}
      <aside className="isolate relative mt-10 flex flex-col gap-4 overflow-hidden rounded-[--radius-card] border border-line p-6 sm:flex-row sm:items-center sm:justify-between">
        <Image
          src="/photos/pods-leaf.webp"
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 1100px"
          className="-z-10 object-cover object-right"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-cream via-cream/80 to-transparent"
        />
        <div className="relative">
          <h2 className="font-display text-lg text-forest">
            Not sure which grade you want?
          </h2>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-body">
            Extra Bold, Bold and Superior differ by capsule size, not by where
            they grew. We explain how the grading works and what it means in the
            kitchen.
          </p>
        </div>
        <ButtonLink
          href="/quality"
          variant="outline"
          className="relative shrink-0 rounded-xl bg-surface/80 backdrop-blur-sm"
        >
          How we grade <ArrowRight className="size-4" />
        </ButtonLink>
      </aside>
    </div>
  );
}
