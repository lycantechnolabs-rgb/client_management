import Image from "next/image";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { Badge, Card, CardBody, EmptyState } from "@/components/ui";
import { money } from "@/lib/utils";

export const metadata = { title: "Products" };

export default async function AdminProducts() {
  await requireAdmin();

  const products = await db.product.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      variants: { orderBy: { sortOrder: "asc" } },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });

  if (products.length === 0) {
    return <EmptyState title="No products yet" />;
  }

  const lowStock = products.flatMap((p) =>
    p.variants.filter((v) => v.stock < 15).map((v) => ({ p, v })),
  );

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl text-forest lg:hidden">Products</h1>

      {lowStock.length > 0 ? (
        <Card className="border-warning/40 bg-warning/8">
          <CardBody>
            <p className="text-sm font-medium text-warning">
              Running low ({lowStock.length})
            </p>
            <ul className="mt-2 space-y-1 text-sm text-body">
              {lowStock.map(({ p, v }) => (
                <li key={v.id}>
                  {p.name} · {v.label} — {v.stock} left
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <div className="space-y-4">
        {products.map((p) => (
          <Card key={p.id}>
            <CardBody>
              <div className="flex gap-4">
                {p.images[0] ? (
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-tint">
                    <Image
                      src={p.images[0].url}
                      alt={p.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base text-forest">
                      {p.name}
                    </h2>
                    {p.isFeatured ? <Badge tone="moss">Featured</Badge> : null}
                    {!p.isActive ? <Badge tone="danger">Hidden</Badge> : null}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                    {p.shortDescription}
                  </p>
                </div>
              </div>

              <ul className="mt-4 divide-y divide-line-soft border-t border-line-soft">
                {p.variants.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="text-body">
                      {v.label}
                      <span className="ms-2 text-xs text-muted">{v.sku}</span>
                    </span>
                    <span className="flex items-center gap-4">
                      <span
                        className={
                          v.stock < 15 ? "text-warning" : "text-muted"
                        }
                      >
                        {v.stock} in stock
                      </span>
                      <span className="font-medium text-forest">
                        {money(v.price)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted">
        Editing products from the admin is a phase-two item — for the demo,
        products and stock come from the seed data.
      </p>
    </div>
  );
}
