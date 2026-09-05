import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getThread } from "@/lib/messages";
import { MarkThreadRead } from "@/components/mark-thread-read";
import { MessageThread } from "@/components/message-thread";

export default async function AdminThreadPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const admin = await requireAdmin();
  const { clientId } = await params;

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, code: true, name: true, phone: true, whatsapp: true },
  });
  if (!client) notFound();

  const messages = await getThread(client.id, admin.id);

  const phone = client.whatsapp ?? client.phone;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/admin/messages"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-forest"
      >
        <ArrowLeft className="size-4" /> All messages
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl text-forest">{client.name}</h1>
          <p className="text-xs text-muted">{client.code}</p>
        </div>
        {phone ? (
          <span className="flex gap-2">
            <a
              href={`tel:${phone}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-forest/25 px-4 text-sm text-forest hover:bg-tint"
            >
              <Phone className="size-4" /> Call
            </a>
            <a
              href={`https://wa.me/91${phone.replace(/\D/g, "").slice(-10)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-forest/25 px-4 text-sm text-forest hover:bg-tint"
            >
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          </span>
        ) : null}
      </div>

      <MarkThreadRead clientId={client.id} />

      <MessageThread
        messages={messages}
        clientId={client.id}
        placeholder={`Write to ${client.name.split(" ")[0]}…`}
        emptyTitle="Nothing said yet"
        emptyDescription="Send the first message — it appears in their portal."
      />
    </div>
  );
}
