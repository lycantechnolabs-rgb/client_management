import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { Badge, Card, CardBody, EmptyState } from "@/components/ui";
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

export default async function AdminOrders() {
  await requireAdmin();

  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        description="Orders placed on the shop will appear here."
      />
    );
  }

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
    </div>
  );
}
