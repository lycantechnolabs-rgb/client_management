import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { listConversations } from "@/lib/messages";
import { Badge, Card, CardBody, EmptyState } from "@/components/ui";
import { relativeDays } from "@/lib/utils";

export const metadata = { title: "Messages" };

export default async function AdminMessagesPage() {
  await requireAdmin();
  const conversations = await listConversations();

  const waiting = conversations.filter((c) => c.unread > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-xl text-forest lg:hidden">Messages</h1>
        {waiting > 0 ? (
          <Badge tone="info">{waiting} waiting on you</Badge>
        ) : null}
        <p className="w-full text-sm text-body">
          One conversation per grower. Nothing here reaches their phone on its
          own — ring or WhatsApp if it cannot wait.
        </p>
      </div>

      {conversations.length === 0 ? (
        <EmptyState title="No clients yet" />
      ) : (
        <div className="space-y-3">
          {conversations.map(({ client, last, unread }) => (
            <Link key={client.id} href={`/admin/messages/${client.id}`}>
              <Card className="transition-colors hover:border-moss/40">
                <CardBody className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-forest">
                      {client.name}
                      <span className="text-xs font-normal text-muted">
                        {client.code}
                      </span>
                      {unread > 0 ? (
                        <Badge tone="info">{unread} new</Badge>
                      ) : null}
                    </p>
                    {last ? (
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {last.fromAdmin ? "You: " : ""}
                        {last.body}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-sm text-muted">
                        Nothing said yet
                      </p>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    {last ? (
                      <span className="text-xs text-muted">
                        {relativeDays(last.createdAt)}
                      </span>
                    ) : null}
                    <ChevronRight className="size-5 text-muted" />
                  </span>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
