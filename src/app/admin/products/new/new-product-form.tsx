"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button, ButtonLink, Card, CardBody, CardTitle } from "@/components/ui";
import { createProduct } from "../../actions";
import { ProductFields, VariantFields } from "../product-editor";

export function NewProductForm() {
  const [state, action, pending] = useActionState(createProduct, {});

  return (
    <form action={action} className="space-y-5">
      <Link
        href="/admin/products"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-forest"
      >
        <ArrowLeft className="size-4" /> Products
      </Link>

      <Card>
        <CardBody className="space-y-4">
          <CardTitle>New product</CardTitle>
          <ProductFields idPrefix="new-product" />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <CardTitle>First pack size</CardTitle>
          <p className="-mt-2 text-sm text-muted">
            There is nothing to buy without one. More pack sizes can be added
            once the product exists.
          </p>
          <VariantFields idPrefix="new-product-variant" />
        </CardBody>
      </Card>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Create product
        </Button>
        <ButtonLink href="/admin/products" variant="outline">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
