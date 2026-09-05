"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { LanguageSwitch } from "@/components/language-switch";

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof Icons;
  /** Show in the mobile bottom bar. Keep to five or fewer. */
  primary?: boolean;
  /** Unread count. Omitted or zero renders nothing. */
  badge?: number;
};

function Icon({ name, className }: { name: keyof typeof Icons; className?: string }) {
  const Cmp = Icons[name] as React.ComponentType<{ className?: string }>;
  return Cmp ? <Cmp className={className} /> : null;
}

function isActive(pathname: string, href: string, root: string) {
  if (href === root) return pathname === root;
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Mobile-first shell. Bottom tab bar on phones (Jinto logs work standing in
 * an estate; the growers are on phones too), sidebar from `lg` up.
 */
export function PortalShell({
  items,
  root,
  title,
  userName,
  subtitle,
  locale,
  profileLabel,
  action,
  children,
}: {
  items: NavItem[];
  root: string;
  title: string;
  userName: string;
  subtitle?: string;
  /**
   * The reader's language, when this shell should offer to change it.
   *
   * Omitted for the admin: Jinto works in English and a switch there would be
   * a control that does nothing for him beside every page heading.
   */
  locale?: string;
  /**
   * The profile link's accessible name, in the reader's language. A screen
   * reader announces this and nothing else — the link's visible content is
   * two initials — so leaving it in English leaves a Malayalam reader with
   * the one label on the page they cannot see to work around.
   */
  profileLabel?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const primary = items.filter((i) => i.primary).slice(0, 5);

  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar — desktop only */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface lg:flex lg:flex-col">
        <Link href="/" className="flex items-center gap-2 px-5 py-5">
          <span className="grid size-8 place-items-center rounded-full bg-forest font-display text-[15px] leading-none text-cream">
            A
          </span>
          <span className="font-display text-base tracking-wide text-forest">
            AELA
          </span>
        </Link>

        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {items.map((item) => {
            const active = isActive(pathname, item.href, root);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-tint font-medium text-forest"
                    : "text-body hover:bg-cream",
                )}
              >
                <Icon name={item.icon} className="size-4.5" />
                {item.label}
                {item.badge ? (
                  <span className="ms-auto grid min-w-5 place-items-center rounded-full bg-moss px-1.5 py-0.5 text-[11px] font-medium text-cream">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-forest text-xs font-medium text-cream">
              {initials(userName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-forest">
                {userName}
              </p>
              {subtitle ? (
                <p className="truncate text-xs text-muted">{subtitle}</p>
              ) : null}
            </div>
          </div>
          <Link
            href="/api/signout"
            className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-body hover:bg-cream"
          >
            <Icons.LogOut className="size-4.5" />
            Sign out
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — mobile */}
        <header className="glass sticky top-0 z-20 flex items-center justify-between gap-3 border-x-0 border-t-0 border-b-line px-4 py-3 lg:hidden">
          <div className="min-w-0">
            <p className="truncate font-display text-lg text-forest">{title}</p>
            {subtitle ? (
              <p className="truncate text-xs text-muted">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {locale ? <LanguageSwitch current={locale} size="compact" /> : null}
            {action}
            <Link
              href={`${root}/profile`}
              className="grid size-11 place-items-center rounded-full bg-forest text-xs font-medium text-cream"
              aria-label={profileLabel ?? "Your profile"}
            >
              {initials(userName)}
            </Link>
          </div>
        </header>

        {/* Top bar — desktop */}
        <header className="hidden items-center justify-between border-b border-line bg-cream/80 px-8 py-5 lg:flex">
          <div>
            <h1 className="font-display text-2xl text-forest">{title}</h1>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {locale ? <LanguageSwitch current={locale} /> : null}
            {action}
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-12 lg:pt-6">
          {children}
        </main>
      </div>

      {/* Bottom tab bar — mobile */}
      <nav className="glass fixed inset-x-0 bottom-0 z-30 border-x-0 border-b-0 border-t-line pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="grid grid-cols-5">
          {primary.map((item) => {
            const active = isActive(pathname, item.href, root);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px]",
                  active ? "text-forest" : "text-muted",
                )}
              >
                <span className="relative">
                  <Icon
                    name={item.icon}
                    className={cn("size-5", active && "stroke-[2.4]")}
                  />
                  {item.badge ? (
                    <span
                      aria-label={`${item.badge} unread`}
                      className="absolute -end-1.5 -top-1 size-2.5 rounded-full bg-moss ring-2 ring-cream"
                    />
                  ) : null}
                </span>
                <span className="truncate leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
