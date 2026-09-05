import { requireAdmin } from "@/lib/session";
import { NewProductForm } from "./new-product-form";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-2xl">
      <NewProductForm />
    </div>
  );
}
