import { db } from "@/lib/db";
import { requireClient } from "@/lib/session";
import { unreadForClient } from "@/lib/messages";
import { PortalShell, type NavItem } from "@/components/portal-shell";
import { getI18n, type Translator } from "@/lib/i18n";

/**
 * The nav, built per request so the labels can be in the reader's language.
 *
 * A const array cannot be translated — it is evaluated once at module load,
 * before there is a request or a reader. The icons and hrefs are the stable
 * part; only the words move.
 */
function nav(t: Translator): NavItem[] {
  return [
    { href: "/dashboard", label: t("nav.home"), icon: "House", primary: true },
    { href: "/dashboard/activities", label: t("nav.work"), icon: "ClipboardList", primary: true },
    { href: "/dashboard/gallery", label: t("nav.photos"), icon: "Images" },
    { href: "/dashboard/expenses", label: t("nav.money"), icon: "IndianRupee", primary: true },
    { href: "/dashboard/harvest", label: t("nav.harvest"), icon: "PackageOpen" },
    { href: "/dashboard/inputs", label: t("nav.inputs"), icon: "FlaskConical" },
    { href: "/dashboard/documents", label: t("nav.documents"), icon: "FileText" },
    { href: "/dashboard/messages", label: t("nav.messages"), icon: "MessageSquare", primary: true },
    { href: "/dashboard/privacy", label: t("nav.yourData"), icon: "ShieldCheck" },
    { href: "/dashboard/profile", label: t("nav.profile"), icon: "User", primary: true },
    { href: "/dashboard/settings", label: t("nav.settings"), icon: "Settings" },
  ];
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authoritative guard. Middleware only handles navigation.
  const user = await requireClient();
  const client = await db.client.findUnique({
    where: { id: user.clientId },
    select: { name: true, code: true, village: true },
  });

  const unread = await unreadForClient(user.clientId);
  const { locale, t } = await getI18n();
  const items = nav(t).map((item) =>
    item.href === "/dashboard/messages" ? { ...item, badge: unread } : item,
  );

  return (
    <PortalShell
      items={items}
      root="/dashboard"
      title={client?.name ?? t("home.greeting")}
      subtitle={
        client?.village ? `${client.village}, Idukki · ${client.code}` : client?.code
      }
      userName={user.name ?? "Grower"}
      locale={locale}
      profileLabel={t("nav.yourProfile")}
    >
      {children}
    </PortalShell>
  );
}
