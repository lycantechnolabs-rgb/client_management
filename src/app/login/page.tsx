import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getContent } from "@/lib/content";
import { LanguageSwitch } from "@/components/language-switch";
import { getLocale } from "@/lib/i18n";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const c = await getContent();
  const session = await auth();
  if (session?.user) {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/dashboard");
  }

  const { next } = await searchParams;
  const locale = await getLocale();

  return (
    <main className="flex min-h-dvh flex-col">
      {/*
        The switch belongs here more than anywhere else in the portal. A grower
        who reads only Malayalam meets this page before they have an account
        preference to read from — and if the control were only in settings, the
        only way to reach it would be through a screen they cannot read.
      */}
      <header className="flex items-center justify-between gap-3 px-5 py-5">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-forest font-display text-[15px] leading-none text-cream">
            A
          </span>
          <span className="font-display text-lg tracking-wide text-forest">
            AELA
          </span>
        </Link>
        <LanguageSwitch current={locale} size="compact" />
      </header>

      <div className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted">
            Sign in to see the latest from your estate.
          </p>

          <div className="mt-7 rounded-[--radius-card] border border-line bg-surface p-5 sm:p-6">
            <LoginForm next={next} />
          </div>

          <div className="mt-5 rounded-xl border border-dashed border-line bg-tint/40 p-4 text-xs text-body">
            <p className="mb-2 font-medium text-forest">Demo accounts</p>
            <p className="font-mono">jinto@aela.co.in · Admin@123</p>
            <p className="mt-0.5 text-muted">Jinto — full admin</p>
            <p className="mt-2 font-mono">thomas@example.com · Client@123</p>
            <p className="mt-0.5 text-muted">Thomas Mathew — grower, 2 estates</p>
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            Forgotten your password? Call Jinto on{" "}
            <a className="text-forest underline" href={`tel:${c.contact_phone}`}>
              {c.contact_phone_display}
            </a>{" "}
            and he&rsquo;ll reset it.
          </p>
        </div>
      </div>
    </main>
  );
}
