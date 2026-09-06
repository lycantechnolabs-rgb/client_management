import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { Badge, ButtonLink, Card, CardBody, EmptyState } from "@/components/ui";
import { money, shortDate } from "@/lib/utils";
import { OrderStatusControl } from "./order-status";

export const metadata = { title: "Orders" };

const TONE: Record<string, "muted" | "info" | "warning" | "success" | "danger"> = {
  PENDING: "warning",
  CONFIRMED: "info",
  PACKED: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
};

// The store never stops taking orders, so a findMany with no limit here
// fetches every order the business has ever received, with all its line
// items, on every load. Fine at one order; not fine after a season of sales.
const PAGE_SIZE = 50;

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const [orders, total] = await Promise.all([
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { items: true },
    }),
    db.order.count(),
  ]);

  if (total === 0) {
    return (
      <EmptyState
        title="No orders yet"
        description="Orders placed on the shop will appear here."
      />
    );
  }

  const hasNextPage = page * PAGE_SIZE < total;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl text-forest lg:hidden">Orders</h1>

      <div className="space-y-4">
        {orders.map((o) => (
          <Card key={o.id}>
            <CardBody>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm text-forest">
                    {o.orderNumber}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {shortDate(o.createdAt)} · {o.customerName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={TONE[o.status] ?? "muted"}>{o.status}</Badge>
                  <Badge tone={o.paymentStatus === "PAID" ? "success" : "warning"}>
                    {o.paymentStatus}
                  </Badge>
                </div>
              </div>

              <ul className="mt-3 space-y-1.5 text-sm">
                {o.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between gap-3 text-body"
                  >
                    <span>
                      {item.productName} · {item.variantLabel} × {item.quantity}
                    </span>
                    <span>{money(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-baseline justify-between border-t border-line-soft pt-3">
                <span className="text-sm text-muted">Total</span>
                <span className="font-display text-lg text-forest">
                  {money(o.total)}
                </span>
              </div>

              <div className="mt-3 rounded-xl bg-cream/70 p-3 text-xs text-body">
                <p className="font-medium text-forest">Ship to</p>
                <p className="mt-1">
                  {o.addressLine1}
                  {o.addressLine2 ? `, ${o.addressLine2}` : ""}
                  <br />
                  {o.city}, {o.state} {o.pincode}
                  <br />
                  {o.phone} · {o.email}
                </p>
              </div>

              <div className="mt-3">
                <OrderStatusControl orderId={o.id} status={o.status} />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {page > 1 || hasNextPage ? (
        <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-4">
          {page > 1 ? (
            <ButtonLink href={`/admin/orders?page=${page - 1}`} variant="outline">
              Newer
            </ButtonLink>
          ) : (
            <span />
          )}
          <p className="text-xs text-muted">
            Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))} ·{" "}
            {total} in total
          </p>
          {hasNextPage ? (
            <ButtonLink href={`/admin/orders?page=${page + 1}`} variant="outline">
              Older
            </ButtonLink>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}
