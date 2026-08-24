"use client";

import { useActionState } from "react";
import { Loader2, Package, Search } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  Field,
  Input,
} from "@/components/ui";
import { money, shortDate } from "@/lib/utils";
import { lookupOrder } from "../../checkout/actions";

type LookupResult = Awaited<ReturnType<typeof lookupOrder>>;

const STEPS = ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"];

export default function OrderLookupPage() {
  const [state, formAction, pending] = useActionState<LookupResult, FormData>(
    lookupOrder,
    {} as LookupResult,
  );

  const order = "order" in state ? state.order : undefined;
  const error = "error" in state ? state.error : undefined;
  const stepIndex = order ? STEPS.indexOf(order.status) : -1;

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl text-forest">Track your order</h1>
      <p className="mt-2 text-body">
        Enter the order number from your confirmation, along with the email you
        used. No account needed.
      </p>

      <Card className="mt-7">
        <CardBody>
          <form action={formAction} className="space-y-4">
            <Field label="Order number">
              <Input
                name="orderNumber"
                placeholder="CRD-7K3M9Q"
                className="font-mono uppercase"
                required
              />
            </Field>
            <Field label="Email">
              <Input
                name="email"
                type="email"
                inputMode="email"
                placeholder="you@example.com"
                required
              />
            </Field>

            {error ? (
              <p
                role="alert"
                className="rounded-lg bg-danger/8 px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Looking…
                </>
              ) : (
                <>
                  <Search className="size-4" /> Find my order
                </>
              )}
            </Button>
          </form>
        </CardBody>
      </Card>

      {order ? (
        <Card className="mt-6">
          <CardBody className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-lg text-forest">
                  {order.orderNumber}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Placed {shortDate(order.createdAt)}
                </p>
              </div>
              <Package className="size-6 text-moss" />
            </div>

            {order.status === "CANCELLED" ? (
              <p className="rounded-lg bg-danger/8 px-3 py-2 text-sm text-danger">
                This order was cancelled.
              </p>
            ) : (
              <ol className="space-y-2.5">
                {STEPS.map((step, i) => {
                  const reached = stepIndex >= i;
                  return (
                    <li key={step} className="flex items-center gap-3 text-sm">
                      <span
                        className={
                          reached
                            ? "grid size-6 shrink-0 place-items-center rounded-full bg-forest text-[10px] text-cream"
                            : "grid size-6 shrink-0 place-items-center rounded-full border border-line text-[10px] text-muted"
                        }
                      >
                        {i + 1}
                      </span>
                      <span className={reached ? "text-forest" : "text-muted"}>
                        {step.charAt(0) + step.slice(1).toLowerCase()}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            <ul className="space-y-2 border-t border-line-soft pt-4 text-sm">
              {order.items.map((item, i) => (
                <li key={i} className="flex justify-between gap-3 text-body">
                  <span>
                    {item.productName}
                    <span className="text-muted">
                      {" "}
                      · {item.variantLabel} × {item.quantity}
                    </span>
                  </span>
                  <span>{money(item.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-baseline justify-between border-t border-line-soft pt-3">
              <span className="font-medium text-forest">Total</span>
              <span className="font-display text-xl text-forest">
                {money(order.total)}
              </span>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <p className="mt-6 text-center text-sm text-muted">
        Try the demo order <span className="font-mono">CRD-7K3M9Q</span> with{" "}
        <span className="font-mono">priya@example.com</span>.
      </p>
    </div>
  );
}
