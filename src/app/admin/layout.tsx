import { requireAdmin } from "@/lib/session";
import { unreadForAdmin } from "@/lib/messages";
import { PortalShell, type NavItem } from "@/components/portal-shell";

const NAV: NavItem[] = [
  { href: "/admin", label: "Home", icon: "House", primary: true },
  { href: "/admin/clients", label: "Clients", icon: "Users", primary: true },
  { href: "/admin/activities/new", label: "Log work", icon: "CirclePlus", primary: true },
  { href: "/admin/activities", label: "Work log", icon: "ClipboardList", primary: true },
  { href: "/admin/workers", label: "Workers", icon: "HardHat" },
  { href: "/admin/products", label: "Products", icon: "Package" },
  { href: "/admin/orders", label: "Orders", icon: "ShoppingBag", primary: true },
  { href: "/admin/reports", label: "Reports", icon: "ChartColumn" },
  { href: "/admin/messages", label: "Messages", icon: "MessageSquare" },
  { href: "/admin/enquiries", label: "Enquiries", icon: "MailQuestion" },
  { href: "/admin/content", label: "Website content", icon: "PenLine" },
  { href: "/admin/language", label: "Malayalam", icon: "Languages" },
  { href: "/admin/permissions", label: "Permissions", icon: "KeyRound" },
  { href: "/admin/privacy", label: "Data requests", icon: "ShieldCheck" },
  { href: "/admin/profile", label: "Settings", icon: "Settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  const unread = await unreadForAdmin();
  const nav = NAV.map((item) =>
    item.href === "/admin/messages" ? { ...item, badge: unread } : item,
  );

  return (
    <PortalShell
      items={nav}
      root="/admin"
      title="Admin"
      subtitle="Cardamom estate management"
      userName={user.name ?? "Jinto"}
    >
      {children}
    </PortalShell>
  );
}
