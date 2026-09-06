import { requireAdmin } from "@/lib/session";
import { Card, CardBody, CardTitle } from "@/components/ui";
import { PasswordForm } from "@/app/dashboard/settings/settings-forms";

export const metadata = { title: "Settings" };

export default async function AdminProfilePage() {
  const user = await requireAdmin();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-xl text-forest lg:hidden">Settings</h1>

      <Card>
        <CardBody className="space-y-1">
          <CardTitle>Account</CardTitle>
          <p className="text-sm text-body">{user.name ?? "Jinto"}</p>
          <p className="text-sm text-muted">{user.email}</p>
        </CardBody>
      </Card>

      <PasswordForm
        mustChange={user.mustChangePassword}
        w={{
          heading: "Change password",
          current: "Current password",
          next: "New password",
          confirm: "Confirm new password",
          hint: "At least 8 characters.",
          submit: "Save",
        }}
      />
    </div>
  );
}
