import Link from "next/link";
import { ChevronRight, Lock, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { Badge, Card, CardBody, CardTitle, EmptyState } from "@/components/ui";
import { CONFIGURABLE, PERMISSIONS, permissionByKey } from "@/lib/permissions";

export const metadata = { title: "Permissions" };

/**
 * Doc 06's "Manage Permissions", as an overview rather than a grid.
 *
 * A clients-by-permissions matrix is the obvious shape and the wrong one here:
 * Jinto reads this on a phone, and a table that wide either scrolls sideways
 * forever or shrinks its targets past the point of being tappable. What he
 * actually needs from a list of growers is "who is not on the standard" — so
 * that is what this answers, and the editing happens on the grower's own page
 * where there is room for the explanations.
 */
export default async function PermissionsPage() {
  await requireAdmin();

  const [clients, overrides] = await Promise.all([
    db.client.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, isActive: true },
    }),
    db.clientPermission.findMany({
      select: { clientId: true, key: true, allowed: true },
    }),
  ]);

  const byClient = new Map<string, { key: string; allowed: boolean }[]>();
  for (const row of overrides) {
    const list = byClient.get(row.clientId) ?? [];
    list.push({ key: row.key, allowed: row.allowed });
    byClient.set(row.clientId, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl text-forest lg:hidden">
          Permissions
        </h1>
        <p className="mt-1 text-sm text-body lg:mt-0">
          What growers are allowed to do in their own portal. Change any of it
          per grower, without anything being redeployed.
        </p>
      </div>

      <Card className="border-moss/30 bg-tint/25">
        <CardBody className="space-y-3">
          <CardTitle>The standard</CardTitle>
          <p className="text-sm text-body">
            Every grower starts here. Change it for one of them below and only
            that grower moves.
          </p>
          <ul className="divide-y divide-line-soft">
            {PERMISSIONS.map((permission) => (
              <li
                key={permission.key}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="min-w-0 text-sm text-body">
                  {permission.label}
                  {!permission.configurable ? (
                    <span className="ms-2 inline-flex items-center gap-1 text-xs text-muted">
                      <Lock className="size-3" /> always
                    </span>
                  ) : null}
                </span>
                <Badge
                  tone={permission.defaults.CLIENT ? "success" : "muted"}
                >
                  {permission.defaults.CLIENT ? "Allowed" : "Not allowed"}
                </Badge>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <div>
        <h2 className="mb-3 font-display text-lg text-forest">Growers</h2>

        {clients.length === 0 ? (
          <EmptyState title="No clients yet" />
        ) : (
          <div className="space-y-3">
            {clients.map((client) => {
              const changes = byClient.get(client.id) ?? [];

              return (
                <Link
                  key={client.id}
                  href={`/admin/clients/${client.id}`}
                  className="block"
                >
                  <Card className="transition-colors hover:border-moss/40">
                    <CardBody className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-forest">
                          {client.name}
                          <span className="text-xs font-normal text-muted">
                            {client.code}
                          </span>
                          {!client.isActive ? (
                            <Badge tone="danger">Inactive</Badge>
                          ) : null}
                        </p>

                        {changes.length === 0 ? (
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                            <ShieldCheck className="size-3.5 text-moss" />
                            On the standard permissions
                          </p>
                        ) : (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {changes.map((change) => (
                              <Badge
                                key={change.key}
                                tone={change.allowed ? "success" : "danger"}
                              >
                                {change.allowed ? "+" : "−"}{" "}
                                {permissionByKey(change.key)?.label ??
                                  change.key}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-muted" />
                    </CardBody>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-muted">
        {CONFIGURABLE.length} of {PERMISSIONS.length} permissions can be changed
        per grower. The rest come with having an account — to remove those,
        deactivate the client instead.
      </p>
    </div>
  );
}
