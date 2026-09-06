import { MessageCircle } from "lucide-react";
import { requireClient } from "@/lib/session";
import { getThread } from "@/lib/messages";
import { MarkThreadRead } from "@/components/mark-thread-read";
import { MessageThread } from "@/components/message-thread";
import { GRIEVANCE_OFFICER } from "@/lib/dpdp";
import { getI18n } from "@/lib/i18n";

export const metadata = { title: "Messages" };

export default async function GrowerMessagesPage() {
  const [user, { locale, t }] = await Promise.all([requireClient(), getI18n()]);
  const messages = await getThread(user.clientId, user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="font-display text-xl text-forest lg:hidden">{t("messages.title")}</h1>
        <p className="mt-1 text-sm text-body lg:mt-0">
          {t("messages.askAnything", { name: GRIEVANCE_OFFICER.name.split(" ")[0] })}
        </p>
      </div>

      <MarkThreadRead clientId={user.clientId} />

      <MessageThread
        messages={messages}
        placeholder={t("messages.placeholderAsk")}
        emptyTitle={t("messages.noMessagesYet")}
        labelWord={t("messages.yourMessage")}
        sendWord={t("messages.send")}
        locale={locale}
        emptyDescription="Write the first one — it goes straight to Jinto."
      />

      <p className="flex items-start gap-2 text-xs text-muted">
        <MessageCircle className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {t("messages.urgentRing", { name: GRIEVANCE_OFFICER.name.split(" ")[0] })}{" "}
          <a
            href={`tel:${GRIEVANCE_OFFICER.phone}`}
            className="underline hover:text-forest"
          >
            {GRIEVANCE_OFFICER.phoneDisplay}
          </a>
          {t("messages.doNotRing")}
        </span>
      </p>
    </div>
  );
}
