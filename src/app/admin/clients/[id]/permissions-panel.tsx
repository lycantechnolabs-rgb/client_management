"use client";

import { useState, useTransition } from "react";
import { Loader2, Lock, RotateCcw } from "lucide-react";
import { Badge, Button, Card, CardBody, CardTitle } from "@/components/ui";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  roleDefault,
} from "@/lib/permissions";
import { resetClientPermissions, setClientPermission } from "../../actions";

/**
 * Jinto's controls for one grower.
 *
 * The screen distinguishes three states, not two: allowed, not allowed, and
 * *changed from the standard*. Without that third signal a list of toggles
 * cannot tell him which of these he actually decided and which are just how
 * every grower starts — which is exactly what he needs to know when a grower
 * rings up asking why something disappeared.
 */
export function PermissionsPanel({
  clientId,
  clientName,
  overrides,
}: {
  clientId: string;
  clientName: string;
  /** Only the stored decisions. Absent key means "on the default". */
  overrides: Record<string, boolean>;
}) {
  const [state, setState] = useState<{ error?: string; message?: string }>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Mirrors the server so a toggle responds under the thumb; the revalidate
  // that follows is what makes it true.
  const [local, setLocal] = useState(overrides);

  const changedCount = Object.keys(local).length;

  function toggle(key: string, next: boolean) {
    setBusyKey(key);
    setLocal((prev) => {
      const copy = { ...prev };
      if (next === roleDefault("CLIENT", key)) delete copy[key];
      else copy[key] = next;
      return copy;
    });
    startTransition(async () => {
      const result = await setClientPermission(clientId, key, next);
      setState(result);
      setBusyKey(null);
    });
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>What {clientName.split(" ")[0]} can do</CardTitle>
          {changedCount > 0 ? (
            <Badge tone="info">{changedCount} changed</Badge>
          ) : (
            <Badge tone="muted">Standard</Badge>
          )}
        </div>

        <p className="-mt-1 text-sm text-body">
          These apply to this grower only. Anything left on the standard setting
          follows whatever you choose for everyone later.
        </p>

        {PERMISSION_GROUPS.map((group) => {
          const rows = PERMISSIONS.filter((p) => p.group === group);
          if (rows.length === 0) return null;

          return (
            <div key={group}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                {group}
              </p>
              <ul className="mt-2 divide-y divide-line-soft">
                {rows.map((permission) => {
                  const fallback = roleDefault("CLIENT", permission.key);
                  const allowed = local[permission.key] ?? fallback;
                  const changed = permission.key in local;

                  return (
                    <li
                      key={permission.key}
                      className="flex items-start justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-forest">
                          {permission.label}
                          {changed ? (
                            <Badge tone="info">Changed</Badge>
                          ) : null}
                          {!permission.configurable ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-normal text-muted"
                              title="Comes with having an account"
                            >
                              <Lock className="size-3" /> Always on
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">
                          {permission.description}
                        </p>
                      </div>

                      {permission.configurable ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={allowed}
                          aria-label={`${permission.label} for ${clientName}`}
                          disabled={pending && busyKey === permission.key}
                          onClick={() => toggle(permission.key, !allowed)}
                          // The button is a full 44px tall with the track drawn
                          // inside it, rather than a 28px control with an
                          // invisible span faking the hit area: the same size a
                          // thumb needs, and one an audit can actually measure.
                          className="grid h-11 w-12 shrink-0 place-items-center disabled:opacity-50"
                        >
                          <span
                            className={`flex h-7 w-12 items-center rounded-full transition-colors ${
                              allowed ? "bg-forest" : "bg-line"
                            }`}
                          >
                            <span
                              className={`inline-block size-5 rounded-full bg-surface shadow transition-transform ${
                                allowed ? "translate-x-6" : "translate-x-1"
                              }`}
                            >
                              {pending && busyKey === permission.key ? (
                                <Loader2 className="size-5 animate-spin p-0.5 text-muted" />
                              ) : null}
                            </span>
                          </span>
                        </button>
                      ) : (
                        <Badge tone="success">On</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {state.error ? (
          <p className="text-sm text-danger">{state.error}</p>
        ) : null}
        {state.message ? (
          <p className="text-sm text-moss">{state.message}</p>
        ) : null}

        {changedCount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (confirm(`Put ${clientName} back on the standard permissions?`)) {
                startTransition(async () => {
                  const result = await resetClientPermissions(clientId);
                  setState(result);
                  if (result.ok) setLocal({});
                });
              }
            }}
          >
            <RotateCcw className="size-4" /> Back to standard
          </Button>
        ) : null}
      </CardBody>
    </Card>
  );
}
