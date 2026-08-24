import { requireAdmin } from "@/lib/session";
import { PortalShell, type NavItem } from "@/components/portal-shell";

const NAV: NavItem[] = [
  { href: "/admin", label: "Home", icon: "House", primary: true },
  { href: "/admin/clients", label: "Clients", icon: "Users", primary: true },
  { href: "/admin/activities/new", label: "Log work", icon: "CirclePlus", primary: true },
  { href: "/admin/activities", label: "Work log", icon: "ClipboardList", primary: true },
  { href: "/admin/workers", label: "Workers", icon: "HardHat" },
  { href: "/admin/store", label: "Products", icon: "Package" },
  { href: "/admin/orders", label: "Orders", icon: "ShoppingBag", primary: true },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <PortalShell
      items={NAV}
      root="/admin"
      title="Admin"
      subtitle="Cardamom estate management"
      userName={user.name ?? "Jinto"}
    >
      {children}
    </PortalShell>
  );
}
