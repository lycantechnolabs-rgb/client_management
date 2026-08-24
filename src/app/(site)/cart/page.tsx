"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart";
import { ButtonLink, Card, CardBody, EmptyState } from "@/components/ui";
import { FREE_SHIPPING_ABOVE, SHIPPING_FLAT_RATE } from "@/lib/constants";
import { money } from "@/lib/utils";

export default function CartPage() {
  const { lines, subtotal, setQuantity, remove, ready } = useCart();

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="h-40 animate-pulse rounded-[--radius-card] bg-line-soft" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="mb-8 font-display text-3xl text-forest">Your cart</h1>
        <EmptyState
          title="Nothing in the cart yet"
          description="Have a look at what we have in stock this season."
          action={<ButtonLink href="/store">Browse cardamom</ButtonLink>}
        />
      </div>
    );
  }

  const shipping = subtotal >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FLAT_RATE;
  const total = subtotal + shipping;
  const away = FREE_SHIPPING_ABOVE - subtotal;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-forest">Your cart</h1>

      <div className="mt-7 space-y-3">
        {lines.map((line) => (
          <Card key={line.variantId}>
            <CardBody className="flex gap-4">
              <Link
                href={`/store/${line.productSlug}`}
                className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-tint"
              >
                {line.image ? (
                  <Image
                    src={line.image}
                    alt={line.productName}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : null}
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/store/${line.productSlug}`}
                      className="block truncate font-display text-base text-forest hover:underline"
                    >
                      {line.productName}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">
                      {line.variantLabel} · {money(line.unitPrice)} each
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(line.variantId)}
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:text-danger"
                    aria-label={`Remove ${line.productName}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center rounded-full border border-line">
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(line.variantId, line.quantity - 1)
                      }
                      className="grid size-10 place-items-center rounded-full text-forest"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium text-forest">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(line.variantId, line.quantity + 1)
                      }
                      className="grid size-10 place-items-center rounded-full text-forest"
                      aria-label="Increase quantity"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <span className="font-medium text-forest">
                    {money(line.unitPrice * line.quantity)}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {away > 0 ? (
        <p className="mt-4 rounded-xl bg-tint/60 px-4 py-3 text-sm text-body">
          Add {money(away)} more for free delivery.
        </p>
      ) : null}

      <Card className="mt-6">
        <CardBody className="space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Subtotal</span>
            <span className="text-body">{money(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Delivery</span>
            <span className="text-body">
              {shipping === 0 ? "Free" : money(shipping)}
            </span>
          </div>
          <div className="flex items-baseline justify-between border-t border-line-soft pt-3">
            <span className="font-medium text-forest">Total</span>
            <span className="font-display text-2xl text-forest">
              {money(total)}
            </span>
          </div>
          <p className="text-xs text-muted">Inclusive of GST.</p>
        </CardBody>
      </Card>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row-reverse">
        <ButtonLink href="/checkout" size="lg" className="flex-1">
          <ShoppingBag className="size-4" /> Checkout
        </ButtonLink>
        <ButtonLink href="/store" variant="outline" size="lg" className="flex-1">
          Keep shopping
        </ButtonLink>
      </div>

      <p className="mt-5 text-center text-xs text-muted">
        No account needed — you&rsquo;ll get an order number to track it with.
      </p>
    </div>
  );
}
