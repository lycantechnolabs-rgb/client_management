import { db } from "@/lib/db";
import { requireClient } from "@/lib/session";
import { Card, CardBody } from "@/components/ui";
import { LanguageSwitch } from "@/components/language-switch";
import { getI18n } from "@/lib/i18n";
import { ContactForm, PasswordForm } from "./settings-forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireClient();

  const client = await db.client.findUnique({
    where: { id: user.clientId },
    select: { phone: true, whatsapp: true, email: true, address: true },
  });

  // From the database rather than the session: the session's copy is only as
  // fresh as the last token refresh, and a grower who just changed their
  // password should not be told again that they still need to.
  const account = await db.user.findUnique({
    where: { id: user.id },
    select: { email: true, mustChangePassword: true },
  });

  const { locale, t } = await getI18n();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-xl text-forest lg:hidden">
          {t("settings.title")}
        </h1>
        <p className="mt-1 text-sm text-body lg:mt-0">{t("settings.subtitle")}</p>
      </div>

      {/*
        Placed first, above the password. A grower who cannot read the page is
        not going to scroll past two forms in a language they do not have to
        find the control that fixes it — and both options are written in their
        own script, so the right one is recognisable before anything is tapped.
      */}
      <Card variant="glass">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-forest">
              {t("settings.language")}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {t("settings.languageHint")}
            </p>
          </div>
          <LanguageSwitch current={locale} />
        </CardBody>
      </Card>

      <PasswordForm
        mustChange={account?.mustChangePassword ?? false}
        w={{
          heading: t("settings.changePassword"),
          current: t("settings.current"),
          next: t("settings.new"),
          confirm: t("settings.confirm"),
          hint: t("settings.atLeast8"),
          submit: t("settings.save"),
        }}
      />

      <ContactForm
        w={{
          heading: t("settings.howWeReach"),
          body: t("settings.keepCurrentBody"),
          phone: t("profile.phone"),
          whatsapp: t("settings.whatsapp"),
          email: t("profile.email"),
          address: t("profile.address"),
          submit: t("settings.saveLabel"),
          emailFixed: t("settings.emailFixed"),
        }}
        phone={client?.phone ?? ""}
        whatsapp={client?.whatsapp ?? ""}
        email={account?.email ?? client?.email ?? ""}
        address={client?.address ?? ""}
      />
    </div>
  );
}
