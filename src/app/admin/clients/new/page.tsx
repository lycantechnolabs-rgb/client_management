import { requireAdmin } from "@/lib/session";
import { NewClientForm } from "./new-client-form";

export const metadata = { title: "Add client" };

export default async function NewClientPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-2xl">
      <NewClientForm />
    </div>
  );
}
