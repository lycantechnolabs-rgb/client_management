"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { useCart } from "@/components/cart";
import {
  Button,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  Label,
  Textarea,
} from "@/components/ui";
import { FREE_SHIPPING_ABOVE, SHIPPING_FLAT_RATE } from "@/lib/constants";
import { money } from "@/lib/utils";
import { placeOrder, type CheckoutState } from "./actions";

export default function CheckoutPage() {
  const { lines, subtotal, clear, ready } = useCart();
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(
    placeOrder,
    {},
  );
  // The confirmed order number comes straight from the action state — no need
  // to mirror it into local state. The effect only touches the cart, which is
  // an external store, and a ref guards it so emptying the cart cannot
  // re-trigger it.
  const done = state.orderNumber ?? null;
  const clearedFor = useRef<string | null>(null);

  useEffect(() => {
    if (done && clearedFor.current !== done) {
      clearedFor.current = done;
      clear();
    }
  }, [done, clear]);

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <CheckCircle2 className="mx-auto size-14 text-success" />
        <h1 className="mt-5 font-display text-3xl text-forest">Thank you!</h1>
        <p className="mt-2 text-body">
          Your order is confirmed. We&rsquo;ll pack it and send you a note when
          it ships.
        </p>
        <p className="mt-6 rounded-xl bg-tint/60 px-4 py-4">
          <span className="block text-xs text-muted">Your order number</span>
          <span className="mt-1 block font-mono text-2xl text-forest">
            {done}
          </span>
        </p>
        <p className="mt-3 text-sm text-muted">
          Keep this to track your order — no account needed.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <ButtonLink href="/orders/lookup">Track this order</ButtonLink>
          <ButtonLink href="/store" variant="outline">
            Keep shopping
          </ButtonLink>
        </div>
      </div>
    );
  }

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
        <EmptyState
          title="Your cart is empty"
          description="Add something before checking out."
          action={<ButtonLink href="/store">Browse cardamom</ButtonLink>}
        />
      </div>
    );
  }

  const shipping = subtotal >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FLAT_RATE;
  const total = subtotal + shipping;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-forest">Checkout</h1>
      <p className="mt-1.5 text-sm text-muted">
        No account needed. We only ask for what we need to deliver.
      </p>

      <form action={formAction} className="mt-8 grid gap-6 lg:grid-cols-5">
        <input
          type="hidden"
          name="cart"
          value={JSON.stringify(
            lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
          )}
        />

        <div className="space-y-5 lg:col-span-3">
          <Card>
            <CardBody className="space-y-4">
              <Label>Where should it go?</Label>
              <Field label="Full name">
                <Input name="customerName" autoComplete="name" required />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Email" hint="For the order confirmation.">
                  <Input
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                  />
                </Field>
              </div>
              <Field label="Address">
                <Input
                  name="addressLine1"
                  autoComplete="address-line1"
                  placeholder="House name / number, street"
                  required
                />
              </Field>
              <Field label="Area (optional)">
                <Input name="addressLine2" autoComplete="address-line2" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Town / city">
                  <Input name="city" autoComplete="address-level2" required />
                </Field>
                <Field label="State">
                  <Input
                    name="state"
                    autoComplete="address-level1"
                    defaultValue="Kerala"
                    required
                  />
                </Field>
                <Field label="PIN code">
                  <Input
                    name="pincode"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={6}
                    required
                  />
                </Field>
              </div>
              <Field label="Delivery notes (optional)">
                <Textarea name="notes" rows={2} />
              </Field>
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-24">
            <Card>
              <CardBody className="space-y-4">
                <Label>Your order</Label>
                <ul className="space-y-2.5 text-sm">
                  {lines.map((l) => (
                    <li
                      key={l.variantId}
                      className="flex justify-between gap-3 text-body"
                    >
                      <span className="min-w-0">
                        {l.productName}
                        <span className="text-muted">
                          {" "}
                          · {l.variantLabel} × {l.quantity}
                        </span>
                      </span>
                      <span className="shrink-0">
                        {money(l.unitPrice * l.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-2 border-t border-line-soft pt-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Subtotal</span>
                    <span className="text-body">{money(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Delivery</span>
                    <span className="text-body">
                      {shipping === 0 ? "Free" : money(shipping)}
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline justify-between border-t border-line-soft pt-3">
                  <span className="font-medium text-forest">Total</span>
                  <span className="font-display text-2xl text-forest">
                    {money(total)}
                  </span>
                </div>

                {state.error ? (
                  <p
                    role="alert"
                    className="rounded-lg bg-danger/8 px-3 py-2 text-sm text-danger"
                  >
                    {state.error}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={pending}
                >
                  {pending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Placing
                      order…
                    </>
                  ) : (
                    <>
                      <Lock className="size-4" /> Place order
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-muted">
                  Demo checkout — no payment is taken. Razorpay goes here, with
                  the order confirmed only after the webhook is verified.
                </p>

                <p className="text-center text-xs text-muted">
                  <Link href="/cart" className="underline hover:text-forest">
                    Back to cart
                  </Link>
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
