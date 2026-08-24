"use client";

import { useTransition } from "react";
import { Select } from "@/components/ui";
import { ORDER_STATUSES } from "@/lib/constants";
import { updateOrderStatus } from "../actions";

export function OrderStatusControl({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Status</span>
      <Select
        defaultValue={status}
        disabled={pending}
        className="max-w-44 py-2"
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await updateOrderStatus(orderId, next);
          });
        }}
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </option>
        ))}
      </Select>
    </label>
  );
}
