"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Field,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import { CARDAMOM_GRADES } from "@/lib/constants";
import { money } from "@/lib/utils";
import {
  addProductImage,
  addVariant,
  adjustStock,
  deleteProduct,
  moveProductImage,
  removeProductImage,
  removeVariant,
  setStock,
  toggleProductActive,
  toggleProductFeatured,
  updateProduct,
  updateVariant,
} from "../actions";

/** Below this a pack shows as running low — the same line the list header uses. */
export const LOW_STOCK = 15;

export type VariantView = {
  id: string;
  label: string;
  weightGrams: number;
  price: number;
  compareAt: number | null;
  stock: number;
  sku: string | null;
  sortOrder: number;
  orderCount: number;
};

export type ImageView = {
  id: string;
  url: string;
  alt: string | null;
};

export type ProductView = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  grade: string | null;
  origin: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  variants: VariantView[];
  images: ImageView[];
};

/* -------------------------------------------------------------------------- */

function IconButton({
  label,
  onClick,
  danger = false,
  active = false,
  busy = false,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
  busy?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      aria-label={label}
      title={label}
      className={`grid size-11 place-items-center rounded-lg transition-colors disabled:opacity-40 ${
        danger
          ? "text-danger hover:bg-danger/10"
          : active
            ? "bg-tint text-forest"
            : "text-muted hover:bg-tint hover:text-forest"
      }`}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : children}
    </button>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  return message ? <p className="text-sm text-danger">{message}</p> : null;
}

/**
 * The pack fields, used by three callers: creating a product, adding a pack to
 * one, and editing an existing pack. Names match what readVariant() expects.
 */
export function VariantFields({
  idPrefix,
  variant,
}: {
  idPrefix: string;
  variant?: VariantView;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label htmlFor={`${idPrefix}-label`}>Pack</Label>
          <Input
            id={`${idPrefix}-label`}
            name="label"
            placeholder="250 g"
            defaultValue={variant?.label ?? ""}
            required
          />
        </Field>
        <Field>
          <Label htmlFor={`${idPrefix}-weight`}>Weight (grams)</Label>
          <Input
            id={`${idPrefix}-weight`}
            name="weightGrams"
            type="number"
            min="1"
            inputMode="numeric"
            defaultValue={variant?.weightGrams ?? ""}
            required
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field>
          <Label htmlFor={`${idPrefix}-price`}>Price (₹)</Label>
          <Input
            id={`${idPrefix}-price`}
            name="price"
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            defaultValue={variant?.price ?? ""}
            required
          />
        </Field>
        <Field>
          <Label htmlFor={`${idPrefix}-compare`}>Was (₹)</Label>
          <Input
            id={`${idPrefix}-compare`}
            name="compareAt"
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            placeholder="Optional"
            defaultValue={variant?.compareAt ?? ""}
          />
        </Field>
        <Field>
          <Label htmlFor={`${idPrefix}-stock`}>In stock</Label>
          <Input
            id={`${idPrefix}-stock`}
            name="stock"
            type="number"
            min="0"
            inputMode="numeric"
            defaultValue={variant?.stock ?? 0}
            required
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label htmlFor={`${idPrefix}-sku`}>SKU</Label>
          <Input
            id={`${idPrefix}-sku`}
            name="sku"
            placeholder="Optional"
            defaultValue={variant?.sku ?? ""}
          />
        </Field>
        <Field>
          <Label htmlFor={`${idPrefix}-order`}>Shows at position</Label>
          <Input
            id={`${idPrefix}-order`}
            name="variantSortOrder"
            type="number"
            inputMode="numeric"
            defaultValue={variant?.sortOrder ?? 0}
          />
        </Field>
      </div>
    </>
  );
}

/**
 * The product fields, shared by the new-product page and the inline editor.
 * The slug is deliberately left blank when creating — it is derived from the
 * name — and pre-filled when editing, where changing it moves the public URL.
 */
export function ProductFields({
  idPrefix,
  product,
}: {
  idPrefix: string;
  product?: ProductView;
}) {
  return (
    <>
      <Field>
        <Label htmlFor={`${idPrefix}-name`}>Product name</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          placeholder="Alleppey Green Extra Bold"
          defaultValue={product?.name ?? ""}
          required
        />
      </Field>
      <Field>
        <Label htmlFor={`${idPrefix}-short`}>One-line description</Label>
        <Input
          id={`${idPrefix}-short`}
          name="shortDescription"
          placeholder="Shown under the name on the shop listing"
          defaultValue={product?.shortDescription ?? ""}
        />
      </Field>
      <Field>
        <Label htmlFor={`${idPrefix}-desc`}>Full description</Label>
        <Textarea
          id={`${idPrefix}-desc`}
          name="description"
          defaultValue={product?.description ?? ""}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label htmlFor={`${idPrefix}-grade`}>Grade</Label>
          <Select
            id={`${idPrefix}-grade`}
            name="grade"
            defaultValue={product?.grade ?? ""}
          >
            <option value="">Not graded</option>
            {CARDAMOM_GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor={`${idPrefix}-origin`}>Origin</Label>
          <Input
            id={`${idPrefix}-origin`}
            name="origin"
            defaultValue={product?.origin ?? "Idukki, Kerala"}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {product ? (
          <Field>
            <Label htmlFor={`${idPrefix}-slug`}>Web address</Label>
            <Input
              id={`${idPrefix}-slug`}
              name="slug"
              defaultValue={product.slug}
            />
            <p className="mt-1 text-xs text-muted">
              /store/{product.slug} — changing this breaks links already shared.
            </p>
          </Field>
        ) : null}
        <Field>
          <Label htmlFor={`${idPrefix}-order`}>Shows at position</Label>
          <Input
            id={`${idPrefix}-order`}
            name="sortOrder"
            type="number"
            inputMode="numeric"
            defaultValue={product?.sortOrder ?? 0}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-5 pt-1">
        <label className="flex items-center gap-2 text-sm text-body">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={product?.isActive ?? true}
            className="size-4 accent-forest"
          />
          Show in the shop
        </label>
        <label className="flex items-center gap-2 text-sm text-body">
          <input
            type="checkbox"
            name="isFeatured"
            defaultChecked={product?.isFeatured ?? false}
            className="size-4 accent-forest"
          />
          Feature on the home page
        </label>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Packs                                                                       */
/* -------------------------------------------------------------------------- */

function VariantRow({
  variant,
  onlyPack,
}: {
  variant: VariantView;
  onlyPack: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [pending, startTransition] = useTransition();

  const [counting, setCounting] = useState(false);

  // Optimistic so the stepper keeps up with a thumb tapping it repeatedly;
  // the server clamps at zero and the revalidate settles the real number.
  const [shown, setShown] = useState<number | null>(null);
  const stock = shown ?? variant.stock;

  function step(delta: number) {
    setShown(Math.max(0, stock + delta));
    startTransition(async () => {
      const result = await adjustStock(variant.id, delta);
      if (result?.error) {
        setError(result.error);
        setShown(null);
      }
    });
  }

  function commitCount(raw: string) {
    setCounting(false);
    const next = Number(raw);
    if (!Number.isFinite(next) || next < 0 || next === stock) return;
    setShown(next);
    startTransition(async () => {
      const result = await setStock(variant.id, next);
      if (result?.error) {
        setError(result.error);
        setShown(null);
      }
    });
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSaving(async () => {
      const result = await updateVariant({}, data);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setShown(null);
        setEditing(false);
      }
    });
  }

  if (editing) {
    return (
      <li className="space-y-3 py-4">
        <form onSubmit={save} className="space-y-3">
          <input type="hidden" name="id" value={variant.id} />
          <VariantFields idPrefix={`v-${variant.id}`} variant={variant} />
          <ErrorLine message={error} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save pack
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-sm text-body">
          {variant.label}
          {variant.sku ? (
            <span className="ms-2 text-xs text-muted">{variant.sku}</span>
          ) : null}
        </span>
        <span className="shrink-0 text-sm font-medium text-forest">
          {money(variant.price)}
        </span>
      </div>

      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="-ms-2.5 flex items-center gap-1">
          {/* Stock first: it is the number that changes most days. */}
          <IconButton
            label={`One fewer ${variant.label}`}
            onClick={() => step(-1)}
            disabled={stock === 0}
          >
            <Minus className="size-4" />
          </IconButton>
          {counting ? (
            /* After a stock count, stepping from 4 to 60 by ones is absurd —
               so the number itself is an input. */
            <input
              autoFocus
              type="number"
              min="0"
              inputMode="numeric"
              defaultValue={stock}
              aria-label={`Stock of ${variant.label}`}
              onBlur={(event) => commitCount(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitCount(event.currentTarget.value);
                }
                if (event.key === "Escape") setCounting(false);
              }}
              className="min-h-11 w-16 rounded-lg border border-line bg-surface text-center text-sm tabular-nums text-ink focus:border-moss focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setCounting(true)}
              title="Type an exact count"
              className={`inline-flex min-h-11 w-16 items-center justify-center gap-1 rounded-lg text-sm tabular-nums hover:bg-tint ${
                stock === 0
                  ? "text-danger"
                  : stock < LOW_STOCK
                    ? "text-warning"
                    : "text-muted"
              } ${pending ? "opacity-60" : ""}`}
            >
              {stock}
              <span className="text-xs">left</span>
            </button>
          )}
          <IconButton label={`One more ${variant.label}`} onClick={() => step(1)}>
            <Plus className="size-4" />
          </IconButton>

        </span>

        <span className="-me-2.5 flex items-center gap-1">
          <IconButton label="Edit pack" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </IconButton>
          <IconButton
            label={onlyPack ? "The only pack cannot be removed" : "Remove pack"}
            danger
            disabled={onlyPack}
            busy={pending}
            onClick={() => {
              const msg =
                variant.orderCount > 0
                  ? `${variant.label} appears in ${variant.orderCount} order ${
                      variant.orderCount === 1 ? "line" : "lines"
                    }. Those orders keep their own copy of the name and price, so removing the pack will not change them. Continue?`
                  : `Remove the ${variant.label} pack?`;
              if (confirm(msg)) {
                startTransition(async () => {
                  const result = await removeVariant(variant.id);
                  if (result?.error) setError(result.error);
                });
              }
            }}
          >
            <Trash2 className="size-4" />
          </IconButton>
        </span>
      </div>
      <ErrorLine message={error} />
    </li>
  );
}

function AddVariantForm({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startSaving(async () => {
      const result = await addVariant({}, data);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        form.reset();
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="soft"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" /> Add a pack size
      </Button>
    );
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-xl bg-tint/40 p-4">
      <input type="hidden" name="productId" value={productId} />
      <VariantFields idPrefix={`new-v-${productId}`} />
      <ErrorLine message={error} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Add pack
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Imagery                                                                     */
/* -------------------------------------------------------------------------- */

function ImageStrip({
  productId,
  images,
}: {
  productId: string;
  images: ImageView[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [pending, startTransition] = useTransition();

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startSaving(async () => {
      const result = await addProductImage({}, data);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        form.reset();
        setOpen(false);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {images.map((image, index) => (
          // Sized to its controls, not to the picture: three 44px buttons need
          // 132px underneath, and a tile narrower than its own row of buttons
          // pushes them out of the card.
          <div key={image.id} className="w-[8.25rem]">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-tint">
              <Image
                src={image.url}
                alt={image.alt ?? ""}
                fill
                sizes="132px"
                className="object-cover"
              />
              {index === 0 ? (
                <span className="absolute inset-x-0 bottom-0 bg-forest/80 py-0.5 text-center text-[10px] uppercase tracking-wide text-cream">
                  Main
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 flex justify-center">
              <IconButton
                label="Move earlier"
                disabled={index === 0}
                onClick={() =>
                  startTransition(() => {
                    void moveProductImage(image.id, -1);
                  })
                }
              >
                <ChevronLeft className="size-4" />
              </IconButton>
              <IconButton
                label="Move later"
                disabled={index === images.length - 1}
                onClick={() =>
                  startTransition(() => {
                    void moveProductImage(image.id, 1);
                  })
                }
              >
                <ChevronRight className="size-4" />
              </IconButton>
              <IconButton
                label="Remove image"
                danger
                busy={pending}
                onClick={() => {
                  if (confirm("Remove this image from the product?")) {
                    startTransition(async () => {
                      const result = await removeProductImage(image.id);
                      if (result?.error) setError(result.error);
                    });
                  }
                }}
              >
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          </div>
        ))}
      </div>

      {open ? (
        <form onSubmit={add} className="space-y-3 rounded-xl bg-tint/40 p-4">
          <input type="hidden" name="productId" value={productId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <Label htmlFor={`img-url-${productId}`}>Image path</Label>
              <Input
                id={`img-url-${productId}`}
                name="url"
                placeholder="/photos/pods-bowl.webp"
                required
              />
              <p className="mt-1 text-xs text-muted">
                A file already in public/. Uploading from here comes with the
                move to hosted image storage.
              </p>
            </Field>
            <Field>
              <Label htmlFor={`img-alt-${productId}`}>
                Describe it, for screen readers
              </Label>
              <Input
                id={`img-alt-${productId}`}
                name="alt"
                placeholder="Green cardamom pods in a wooden bowl"
              />
            </Field>
          </div>
          <ErrorLine message={error} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Add image
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <ErrorLine message={error} />
          <Button
            type="button"
            size="sm"
            variant="soft"
            onClick={() => setOpen(true)}
          >
            <ImagePlus className="size-4" /> Add an image
          </Button>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The product card                                                            */
/* -------------------------------------------------------------------------- */

export function ProductCard({ product }: { product: ProductView }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSaving(async () => {
      const result = await updateProduct({}, data);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setEditing(false);
      }
    });
  }

  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base text-forest">
                {product.name}
              </h2>
              {product.isFeatured ? <Badge tone="moss">Featured</Badge> : null}
              {!product.isActive ? <Badge tone="danger">Hidden</Badge> : null}
              {totalStock === 0 ? (
                <Badge tone="danger">Sold out</Badge>
              ) : null}
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted">
              {product.shortDescription ?? `/store/${product.slug}`}
            </p>
          </div>

          {/* -ms-2.5 pulls the first icon back to the card's text edge: an
              icon button's padding would otherwise read as a stray indent. */}
          <div className="-ms-2.5 flex shrink-0 items-center gap-1 sm:ms-0">
            <IconButton
              label={
                product.isFeatured
                  ? "Stop featuring on the home page"
                  : "Feature on the home page"
              }
              active={product.isFeatured}
              busy={pending}
              onClick={() =>
                startTransition(() => {
                  void toggleProductFeatured(product.id, !product.isFeatured);
                })
              }
            >
              <Star
                className={`size-4 ${product.isFeatured ? "fill-current" : ""}`}
              />
            </IconButton>
            <IconButton
              label={
                product.isActive ? "Hide from the shop" : "Show in the shop"
              }
              busy={pending}
              onClick={() =>
                startTransition(() => {
                  void toggleProductActive(product.id, !product.isActive);
                })
              }
            >
              {product.isActive ? (
                <Eye className="size-4" />
              ) : (
                <EyeOff className="size-4" />
              )}
            </IconButton>
            <IconButton label="Edit product" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
            </IconButton>
            <IconButton
              label="Remove product"
              danger
              busy={pending}
              onClick={() => {
                if (confirm(`Remove ${product.name} from the shop?`)) {
                  startTransition(async () => {
                    const result = await deleteProduct(product.id);
                    if (result?.error) setError(result.error);
                    // A product that has been ordered is hidden instead, and
                    // the card stays on screen — so say what happened.
                    else if (result?.message) setNote(result.message);
                  });
                }
              }}
            >
              <Trash2 className="size-4" />
            </IconButton>
          </div>
        </div>

        {editing ? (
          <form onSubmit={save} className="space-y-3 border-t border-line-soft pt-5">
            <input type="hidden" name="id" value={product.id} />
            <ProductFields idPrefix={`p-${product.id}`} product={product} />
            <ErrorLine message={error} />
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                Save product
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {note ? <p className="text-sm text-body">{note}</p> : null}
        {!editing ? <ErrorLine message={error} /> : null}

        <ImageStrip productId={product.id} images={product.images} />

        <div className="border-t border-line-soft pt-2">
          <ul className="divide-y divide-line-soft">
            {product.variants.map((variant) => (
              <VariantRow
                key={variant.id}
                variant={variant}
                onlyPack={product.variants.length === 1}
              />
            ))}
          </ul>
          <div className="pt-3">
            <AddVariantForm productId={product.id} />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
