import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Leaf, Package, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { AddToCart } from "./add-to-cart";
import { FREE_SHIPPING_ABOVE } from "@/lib/constants";
import { money } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await db.product.findUnique({ where: { slug } });
  if (!product) return { title: "Not found" };
  return {
    title: product.name,
    description: product.shortDescription ?? undefined,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await db.product.findFirst({
    where: { slug, isActive: true },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      {/* /products is a permanent redirect to /store (next.config.ts), so
          linking there made every back click a round trip. */}
      <Link
        href="/store"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-forest"
      >
        <ArrowLeft className="size-4" /> All cardamom
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-[--radius-card] bg-tint">
            {product.images[0] ? (
              <Image
                src={product.images[0].url}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            ) : null}
          </div>
          {product.images.length > 1 ? (
            <div className="grid grid-cols-4 gap-2">
              {product.images.slice(1).map((img) => (
                <div
                  key={img.id}
                  className="relative aspect-square overflow-hidden rounded-lg bg-tint"
                >
                  <Image
                    src={img.url}
                    alt={img.alt ?? product.name}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          {product.grade ? (
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-moss">
              Grade {product.grade}
            </p>
          ) : null}

          <h1 className="mt-2 font-display text-4xl leading-tight text-forest">
            {product.name}
          </h1>

          <p className="mt-4 leading-relaxed text-body">
            {product.description ?? product.shortDescription}
          </p>

          <div className="mt-7">
            <AddToCart
              productName={product.name}
              productSlug={product.slug}
              image={product.images[0]?.url}
              variants={product.variants.map((v) => ({
                id: v.id,
                label: v.label,
                price: v.price,
                compareAt: v.compareAt,
                stock: v.stock,
              }))}
            />
          </div>

          <ul className="mt-8 space-y-3 border-t border-line pt-6 text-sm text-body">
            <li className="flex items-center gap-3">
              <Leaf className="size-4 shrink-0 text-moss" />
              Single estate, Idukki — nothing blended in
            </li>
            <li className="flex items-center gap-3">
              <Package className="size-4 shrink-0 text-moss" />
              Packed to order, sealed the same day
            </li>
            <li className="flex items-center gap-3">
              <Truck className="size-4 shrink-0 text-moss" />
              Free delivery on orders over {money(FREE_SHIPPING_ABOVE)}
            </li>
          </ul>

          <div className="mt-6 rounded-xl bg-tint/50 p-4 text-sm text-body">
            <p className="font-medium text-forest">Storing it</p>
            <p className="mt-1">
              Keep the pouch sealed, away from heat and sunlight. Whole pods
              hold their aroma for a year; ground cardamom is best within three
              months.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
