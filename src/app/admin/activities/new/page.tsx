import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { commonMaterials } from "@/lib/common-materials";
import { ActivityForm } from "./activity-form";

export const metadata = { title: "Log work" };

export default async function NewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  await requireAdmin();
  const { client } = await searchParams;

  const common = await commonMaterials();

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
      // Workers belong to one estate. They travel with the client so the form
      // can offer the right people the moment the client changes, without a
      // round trip — and so it can never offer someone else's crew.
      //
      // Note what this means: every client's workers, with their daily wage,
      // are serialised into the page. That is acceptable here and only here —
      // this form is admin-only, and Jinto can already list every worker at
      // /admin/workers. If this form is ever opened to anyone else, fetch the
      // workers per client instead; `dailyWage` in particular is not something
      // to hand out broadly.
      workers: {
        where: { isActive: true },
        select: { id: true, name: true, role: true, dailyWage: true },
        orderBy: { name: "asc" },
      },
    },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <ActivityForm clients={clients} defaultClientId={client} common={common} />
    </div>
  );
}
