"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { FREE_SHIPPING_ABOVE, SHIPPING_FLAT_RATE } from "@/lib/constants";
import { makeOrderNumber } from "@/lib/utils";

export type CheckoutState = { error?: string; orderNumber?: string };

const addressSchema = z.object({
  customerName: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(10, "Enter a 10-digit phone number"),
  addressLine1: z.string().min(3, "Enter your address"),
  addressLine2: z.string().optional(),
  city: z.string().min(2, "Enter your town or city"),
  state: z.string().min(2, "Enter your state"),
  pincode: z.string().regex(/^\d{6}$/, "Enter a 6-digit PIN code"),
  notes: z.string().optional(),
});

const cartSchema = z.array(
  z.object({ variantId: z.string(), quantity: z.number().int().min(1).max(20) }),
);

export async function placeOrder(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const parsed = addressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  let cart: z.infer<typeof cartSchema>;
  try {
    cart = cartSchema.parse(JSON.parse(String(formData.get("cart") ?? "[]")));
  } catch {
    return { error: "Your cart looks invalid. Please try again." };
  }
  if (cart.length === 0) return { error: "Your cart is empty." };

  // Prices and stock come from the database, never from the browser.
  const variants = await db.productVariant.findMany({
    where: { id: { in: cart.map((c) => c.variantId) } },
    include: { product: { select: { name: true, isActive: true } } },
  });

  const items: {
    variantId: string;
    productName: string;
    variantLabel: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[] = [];
  for (const line of cart) {
    const variant = variants.find((v) => v.id === line.variantId);
    if (!variant || !variant.product.isActive) {
      return { error: "One of the items is no longer available." };
    }
    if (variant.stock < line.quantity) {
      return {
        error: `Only ${variant.stock} left of ${variant.product.name} ${variant.label}.`,
      };
    }
    items.push({
      variantId: variant.id,
      productName: variant.product.name,
      variantLabel: variant.label,
      unitPrice: variant.price,
      quantity: line.quantity,
      lineTotal: variant.price * line.quantity,
    });
  }

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const shippingFee = subtotal >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FLAT_RATE;

  // Order and stock move together. Checking stock above and decrementing
  // separately is a race: two shoppers can both pass the check on the last
  // packet and both succeed, overselling it. The conditional update below
  // re-checks stock inside the transaction and fails the whole thing if
  // someone got there first.
  let order;
  try {
    order = await db.$transaction(async (tx) => {
      for (const item of items) {
        const claimed = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (claimed.count === 0) {
          throw new Error("OUT_OF_STOCK");
        }
      }

      return tx.order.create({
        data: {
          orderNumber: makeOrderNumber(),
          ...parsed.data,
          addressLine2: parsed.data.addressLine2 || null,
          notes: parsed.data.notes || null,
          subtotal,
          shippingFee,
          total: subtotal + shippingFee,
          status: "CONFIRMED",
          // Demo: marked paid directly. With Razorpay this stays PENDING until
          // the webhook signature is verified server-side — never trust the
          // browser's success callback.
          paymentStatus: "PAID",
          paymentRef: "demo-no-gateway",
          items: { create: items },
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "OUT_OF_STOCK") {
      return { error: "Someone just took the last of that. Please try again." };
    }
    throw err;
  }

  return { orderNumber: order.orderNumber };
}

export async function lookupOrder(_prev: unknown, formData: FormData) {
  const orderNumber = String(formData.get("orderNumber") ?? "")
    .trim()
    .toUpperCase();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!orderNumber || !email) {
    return { error: "Enter both your order number and email." };
  }

  const order = await db.order.findFirst({
    where: { orderNumber, email },
    include: { items: true },
  });

  if (!order) {
    return { error: "No order found with those details." };
  }

  return {
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((i) => ({
        productName: i.productName,
        variantLabel: i.variantLabel,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
      })),
    },
  };
}
