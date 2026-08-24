import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss",
  {
    variants: {
      variant: {
        primary:
          "sheen bg-forest text-cream shadow-card hover:bg-forest-600 hover:shadow-lift",
        outline:
          "border border-forest/25 bg-transparent text-forest hover:border-forest/40 hover:bg-tint",
        soft: "bg-tint text-forest hover:bg-tint/70",
        ghost: "text-forest hover:bg-tint",
        // The warm counterpoint, for the one action on a page that should pull
        // the eye ahead of the green.
        accent:
          "bg-clay text-cream shadow-card hover:bg-clay-600 hover:shadow-lift",
        danger: "bg-danger text-white hover:opacity-90",
      },
      size: {
        // 44px min height — thumb-sized, for one-handed use in the field
        md: "min-h-11 px-5 text-sm",
        lg: "min-h-12 px-6 text-base",
        sm: "min-h-9 px-4 text-sm",
        icon: "size-11 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonStyles({ variant, size }), className)} {...props} />
  );
}

export function ButtonLink({
  className,
  variant,
  size,
  href,
  ...props
}: React.ComponentProps<typeof Link> & VariantProps<typeof buttonStyles>) {
  return (
    <Link
      href={href}
      className={cn(buttonStyles({ variant, size }), className)}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[--radius-card] border border-line bg-surface shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 sm:p-5", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-display text-lg text-forest", className)}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

const badgeStyles = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        forest: "bg-forest/10 text-forest",
        moss: "bg-moss/15 text-moss",
        sage: "bg-sage/20 text-forest",
        clay: "bg-clay/12 text-clay",
        success: "bg-success/12 text-success",
        warning: "bg-warning/12 text-warning",
        danger: "bg-danger/10 text-danger",
        info: "bg-info/12 text-info",
        muted: "bg-line-soft text-muted",
      },
    },
    defaultVariants: { tone: "muted" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeStyles>) {
  return <span className={cn(badgeStyles({ tone }), className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                               */
/* -------------------------------------------------------------------------- */

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-forest", className)}
      {...props}
    />
  );
}

const fieldStyles =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-ink placeholder:text-muted/60 focus:border-moss focus:outline-none disabled:opacity-60";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldStyles, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(fieldStyles, "min-h-24", className)} {...props} />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldStyles, "pr-9", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label ? <Label>{label}</Label> : null}
      {children}
      {hint && !error ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state — every list needs one                                          */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-[--radius-card] border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <div className="mb-3 grid size-14 place-items-center rounded-full bg-tint text-2xl">
        🌿
      </div>
      <p className="font-display text-lg text-forest">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                        */
/* -------------------------------------------------------------------------- */

export function StatTile({
  label,
  value,
  sub,
  tone = "surface",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "surface" | "forest" | "tint";
}) {
  return (
    <div
      className={cn(
        "rounded-[--radius-card] border p-4",
        tone === "forest" && "border-forest bg-forest text-cream",
        tone === "tint" && "border-tint bg-tint",
        tone === "surface" && "border-line bg-surface",
      )}
    >
      <p
        className={cn(
          "text-xs font-medium",
          tone === "forest" ? "text-cream/70" : "text-muted",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-display text-2xl",
          tone === "forest" ? "text-cream" : "text-forest",
        )}
      >
        {value}
      </p>
      {sub ? (
        <p
          className={cn(
            "mt-0.5 text-xs",
            tone === "forest" ? "text-cream/60" : "text-muted",
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}

export function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-lg text-forest">{title}</h2>
      {action}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-line-soft", className)} />;
}
