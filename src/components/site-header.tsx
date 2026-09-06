"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/components/cart";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/store", label: "Store" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({ businessName }: { businessName: string }) {
  const pathname = usePathname();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // At the top of the page the nav sits flush on the hero card, as in the
  // design. The divider only appears once content scrolls under it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The mobile menu covers the screen, so the page behind it should not
  // silently scroll or stay reachable underneath while it's open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <header
      className={cn(
        "top-0 z-40 border-b transition-[background-color,backdrop-filter,border-color,box-shadow] duration-300",
        scrolled || open
          ? "glass border-white/50"
          : "border-transparent bg-transparent shadow-none",
        // Closed: sits in flow, pinned to the top on scroll, as before.
        // Open (mobile only): becomes a full-screen panel — `fixed` takes it
        // out of the document flow entirely, so it covers the page instead of
        // pushing it down, and the top bar plus the link list share the
        // screen as a flex column rather than guessing the top bar's height
        // to offset a separately positioned panel.
        open
          ? "fixed inset-0 flex h-dvh flex-col overflow-hidden lg:sticky lg:inset-auto lg:h-auto lg:flex-none lg:overflow-visible"
          : "sticky",
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl shrink-0 items-center gap-3 px-4 py-3.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo-mark.svg" alt="" width={32} height={32} className="size-8" priority />
          <span className="font-display text-lg tracking-wide text-forest">
            {businessName}
          </span>
        </Link>

        <nav className="ms-auto hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative rounded-full px-3.5 py-2 text-sm transition-colors",
                  active
                    ? "text-forest font-medium"
                    : "text-body hover:text-forest",
                )}
              >
                {l.label}
                {/* Weight alone was doing all the work of marking the current
                    page, which is hard to see across a row of six. A warm dot
                    is unambiguous without shouting. */}
                {active ? (
                  <span className="absolute inset-x-0 bottom-0.5 mx-auto size-1 rounded-full bg-clay" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-1.5 lg:ms-2">
          {/* The growers' portal needs a visible way in — the mockup had none */}
          <Link
            href="/login"
            className="hidden rounded-full px-3.5 py-2 text-sm text-body hover:text-forest sm:block"
          >
            Client login
          </Link>

          <Link
            href="/cart"
            className="relative grid size-11 place-items-center rounded-full text-forest hover:bg-tint"
            aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
          >
            <ShoppingBag className="size-5" />
            {count > 0 ? (
              <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-forest px-1 text-[10px] font-medium text-cream">
                {count}
              </span>
            ) : null}
          </Link>

          <Link
            href="/contact"
            className="hidden rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-cream hover:bg-forest-600 lg:block"
          >
            Get in touch
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid size-11 place-items-center rounded-full text-forest hover:bg-tint lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav className="min-h-0 flex-1 overflow-y-auto border-t border-line bg-cream px-4 pb-4 pt-2 lg:hidden">
          {[...LINKS, { href: "/login", label: "Client login" }].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block min-h-12 border-b border-line-soft py-3 text-body last:border-0"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
