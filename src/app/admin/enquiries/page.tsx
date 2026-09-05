import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { Badge } from "@/components/ui";
import { EnquiryList, type EnquiryRow } from "./enquiry-list";

export const metadata = { title: "Enquiries" };

export default async function EnquiriesPage() {
  await requireAdmin();

  const rows = await db.enquiry.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { handledBy: { select: { name: true } } },
  });

  const enquiries: EnquiryRow[] = rows.map((e) => ({
    id: e.id,
    reference: e.reference,
    name: e.name,
    email: e.email,
    phone: e.phone,
    topic: e.topic,
    message: e.message,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    handledBy: e.handledBy?.name ?? null,
  }));

  const newCount = enquiries.filter((e) => e.status === "NEW").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-xl text-forest lg:hidden">Enquiries</h1>
        {newCount > 0 ? <Badge tone="info">{newCount} new</Badge> : null}
        <p className="w-full text-sm text-body lg:mt-0">
          Messages from the contact form. Answer by phone, WhatsApp or email,
          then mark it here — there is no mailbox in the app yet.
        </p>
      </div>

      <EnquiryList enquiries={enquiries} />
    </div>
  );
}
