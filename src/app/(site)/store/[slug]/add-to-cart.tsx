"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui";
import { useCart } from "@/components/cart";
import { cn, money } from "@/lib/utils";

type Variant = {
  id: string;
  label: string;
  price: number;
  compareAt: number | null;
  stock: number;
};

export function AddToCart({
  productName,
  productSlug,
  image,
  variants,
}: {
  productName: string;
  productSlug: string;
  image?: string;
  variants: Variant[];
}) {
  const { add } = useCart();
  const router = useRouter();

  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];
  const [selected, setSelected] = useState<Variant>(firstAvailable);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const maxQty = Math.max(1, Math.min(selected?.stock ?? 1, 10));
  const outOfStock = !selected || selected.stock === 0;

  function handleAdd(goToCart: boolean) {
    if (outOfStock) return;
    add(
      {
        variantId: selected.id,
        productName,
        productSlug,
        variantLabel: selected.label,
        unitPrice: selected.price,
        image,
      },
      quantity,
    );
    if (goToCart) {
      router.push("/cart");
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div>
      <p className="text-sm font-medium text-forest">Size</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {variants.map((v) => {
          const disabled = v.stock === 0;
          return (
            <button
              key={v.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                setSelected(v);
                setQuantity(1);
              }}
              className={cn(
                "min-h-12 rounded-xl border px-4 text-sm transition-colors",
                selected?.id === v.id
                  ? "border-forest bg-forest text-cream"
                  : "border-line bg-surface text-body hover:border-moss/50",
                disabled && "cursor-not-allowed opacity-40 line-through",
              )}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-baseline gap-3">
        {/* Clay, to match the prices in the store grid — the accent marks
            price consistently across the shop. */}
        <span className="font-display text-3xl text-clay">
          {money(selected?.price ?? 0)}
        </span>
        {selected?.compareAt ? (
          <span className="text-base text-muted line-through">
            {money(selected.compareAt)}
          </span>
        ) : null}
      </div>

      {selected && selected.stock > 0 && selected.stock < 15 ? (
        <p className="mt-1.5 text-sm text-warning">
          Only {selected.stock} left of this size
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border border-line bg-surface">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1 || outOfStock}
            className="grid size-11 place-items-center rounded-full text-forest disabled:opacity-30"
            aria-label="Decrease quantity"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-9 text-center text-sm font-medium text-forest">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
            disabled={quantity >= maxQty || outOfStock}
            className="grid size-11 place-items-center rounded-full text-forest disabled:opacity-30"
            aria-label="Increase quantity"
          >
            <Plus className="size-4" />
          </button>
        </div>

        <Button
          type="button"
          size="lg"
          onClick={() => handleAdd(false)}
          disabled={outOfStock}
          className="flex-1 min-w-40"
        >
          {added ? (
            <>
              <Check className="size-4" /> Added to cart
            </>
          ) : outOfStock ? (
            "Sold out"
          ) : (
            <>
              <ShoppingBag className="size-4" /> Add to cart
            </>
          )}
        </Button>
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mt-3 w-full"
        onClick={() => handleAdd(true)}
        disabled={outOfStock}
      >
        Buy now
      </Button>
    </div>
  );
}
