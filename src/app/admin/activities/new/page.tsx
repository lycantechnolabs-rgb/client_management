import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ActivityForm } from "./activity-form";

export const metadata = { title: "Log work" };

export default async function NewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  await requireAdmin();
  const { client } = await searchParams;

  const clients = await db.client.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      plots: {
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <ActivityForm clients={clients} defaultClientId={client} />
    </div>
  );
}
