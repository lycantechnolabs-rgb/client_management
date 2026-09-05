import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ButtonLink, Card, CardBody, EmptyState } from "@/components/ui";
import { LOW_STOCK, ProductCard, type ProductView } from "./product-editor";

export const metadata = { title: "Products" };

export default async function AdminProducts() {
  await requireAdmin();

  const products = await db.product.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      variants: {
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { orderItems: true } } },
      },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });

  // Prisma rows carry Decimal-ish and _count shapes that a client component
  // cannot take as-is, so they are flattened to the view type here.
  const view: ProductView[] = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    description: p.description,
    grade: p.grade,
    origin: p.origin,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    sortOrder: p.sortOrder,
    images: p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt })),
    variants: p.variants.map((v) => ({
      id: v.id,
      label: v.label,
      weightGrams: v.weightGrams,
      price: v.price,
      compareAt: v.compareAt,
      stock: v.stock,
      sku: v.sku,
      sortOrder: v.sortOrder,
      orderCount: v._count.orderItems,
    })),
  }));

  const lowStock = view.flatMap((p) =>
    p.variants.filter((v) => v.stock < LOW_STOCK).map((v) => ({ p, v })),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl text-forest lg:hidden">Products</h1>
        <ButtonLink href="/admin/products/new" size="sm" className="ms-auto">
          <Plus className="size-4" /> New product
        </ButtonLink>
      </div>

      {lowStock.length > 0 ? (
        <Card className="border-warning/40 bg-warning/8">
          <CardBody>
            <p className="text-sm font-medium text-warning">
              Running low ({lowStock.length})
            </p>
            <ul className="mt-2 space-y-1 text-sm text-body">
              {lowStock.map(({ p, v }) => (
                <li key={v.id}>
                  {p.name} · {v.label} —{" "}
                  {v.stock === 0 ? "sold out" : `${v.stock} left`}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {view.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Add the first pack of cardamom and it appears in the shop straight away."
          action={
            <ButtonLink href="/admin/products/new">Add a product</ButtonLink>
          }
        />
      ) : (
        <div className="space-y-4">
          {view.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
