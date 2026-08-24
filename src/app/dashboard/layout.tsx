import { db } from "@/lib/db";
import { requireClient } from "@/lib/session";
import { PortalShell, type NavItem } from "@/components/portal-shell";

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "House", primary: true },
  { href: "/dashboard/activities", label: "Work", icon: "ClipboardList", primary: true },
  { href: "/dashboard/gallery", label: "Photos", icon: "Images", primary: true },
  { href: "/dashboard/expenses", label: "Money", icon: "IndianRupee", primary: true },
  { href: "/dashboard/harvest", label: "Harvest", icon: "PackageOpen" },
  { href: "/dashboard/inputs", label: "Input log", icon: "FlaskConical" },
  { href: "/dashboard/documents", label: "Documents", icon: "FileText" },
  { href: "/dashboard/profile", label: "Profile", icon: "User", primary: true },
];

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

  return (
    <PortalShell
      items={NAV}
      root="/dashboard"
      title={client?.name ?? "Your estate"}
      subtitle={
        client?.village ? `${client.village}, Idukki · ${client.code}` : client?.code
      }
      userName={user.name ?? "Grower"}
    >
      {children}
    </PortalShell>
  );
}
