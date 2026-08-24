"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, IndianRupee, MessageCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* The cardamom year                                                          */
/* -------------------------------------------------------------------------- */

type Month = {
  short: string;
  name: string;
  phase: string;
  /** 0–3, drives how dark the segment reads. Harvest months are busiest. */
  load: number;
  work: string[];
};

const YEAR: Month[] = [
  {
    short: "Jan", name: "January", phase: "Late harvest", load: 3,
    work: ["Picking rounds continue", "Curing house running", "Grading and weighing"],
  },
  {
    short: "Feb", name: "February", phase: "Harvest closes", load: 3,
    work: ["Final picking rounds", "Curing and drying", "Season totals recorded"],
  },
  {
    short: "Mar", name: "March", phase: "After the harvest", load: 1,
    work: ["Field cleaning and trashing", "Irrigation begins", "Soil testing"],
  },
  {
    short: "Apr", name: "April", phase: "The dry months", load: 2,
    work: ["Shade regulation and lopping", "Irrigation through dry spells", "Gap filling"],
  },
  {
    short: "May", name: "May", phase: "Before the rains", load: 2,
    work: ["Base manuring", "Replanting weak clumps", "Trench and drain clearing"],
  },
  {
    short: "Jun", name: "June", phase: "Monsoon opens", load: 2,
    work: ["First fertilizer round", "Weeding", "Drainage management"],
  },
  {
    short: "Jul", name: "July", phase: "Vegetative growth", load: 2,
    work: ["Plant protection — thrips and rot", "Weeding and mulching", "Panicle inspection"],
  },
  {
    short: "Aug", name: "August", phase: "Flowering", load: 3,
    work: ["Second fertilizer round", "Spraying", "First picking begins"],
  },
  {
    short: "Sep", name: "September", phase: "Picking starts", load: 3,
    work: ["Picking rounds at 40–45 days", "Curing house fired", "Plant protection"],
  },
  {
    short: "Oct", name: "October", phase: "Peak harvest", load: 3,
    work: ["Heaviest picking rounds", "Curing and moisture control", "Grading"],
  },
  {
    short: "Nov", name: "November", phase: "Peak harvest", load: 3,
    work: ["Picking continues", "Curing and grading", "Weighing and packing"],
  },
  {
    short: "Dec", name: "December", phase: "Harvest and cure", load: 2,
    work: ["Picking rounds", "Curing house running", "Third fertilizer round"],
  },
];

const LOAD_FILL = ["#e8efdd", "#cfe0bb", "#9dbd7c", "#4a7c2f"];

/**
 * Coordinates are rounded because Math.cos/Math.sin can differ in the last
 * bits between Node and the browser, which makes the server-rendered path
 * string differ from the client's and trips a React hydration mismatch.
 * Three decimals is far finer than a pixel at this size.
 */
const round = (n: number) => Math.round(n * 1000) / 1000;

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [round(cx + r * Math.cos(a)), round(cy + r * Math.sin(a))];
}

function arc(
  cx: number, cy: number, rOut: number, rIn: number, start: number, end: number,
) {
  const [x1, y1] = polar(cx, cy, rOut, start);
  const [x2, y2] = polar(cx, cy, rOut, end);
  const [x3, y3] = polar(cx, cy, rIn, end);
  const [x4, y4] = polar(cx, cy, rIn, start);
  const large = end - start > 180 ? 1 : 0;
  return `M${x1},${y1} A${rOut},${rOut} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${rIn},${rIn} 0 ${large} 0 ${x4},${y4} Z`;
}

/**
 * A radial calendar of the cardamom year. Auto-advances until the visitor
 * touches it, then stays where they put it.
 */
export function CardamomYear() {
  // A fixed starting month, not new Date().getMonth(): the server may be on a
  // different date to the visitor's device, which would hydrate mismatched.
  // October is peak harvest, so it is the month worth landing on anyway.
  const [active, setActive] = useState(9);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (touched) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setActive((m) => (m + 1) % 12), 2600);
    return () => clearInterval(id);
  }, [touched]);

  const m = YEAR[active];
  const pick = (i: number) => {
    setActive(i);
    setTouched(true);
  };

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="relative mx-auto w-full max-w-[420px]">
        <svg viewBox="0 0 400 400" className="w-full" role="group"
          aria-label="The cardamom year, month by month">
          <defs>
            <filter id="wheelShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="10"
                floodColor="#2e4a1c" floodOpacity="0.14" />
            </filter>
          </defs>

          <g filter="url(#wheelShadow)">
            {YEAR.map((mo, i) => {
              const start = i * 30 + 0.9;
              const end = (i + 1) * 30 - 0.9;
              const on = i === active;
              return (
                <path
                  key={mo.short}
                  d={arc(200, 200, on ? 192 : 182, 128, start, end)}
                  fill={on ? "#2e4a1c" : LOAD_FILL[mo.load]}
                  className="cursor-pointer transition-all duration-300"
                  onMouseEnter={() => pick(i)}
                  onFocus={() => pick(i)}
                  onClick={() => pick(i)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${mo.name} — ${mo.phase}`}
                  aria-pressed={on}
                />
              );
            })}
          </g>

          {/* month initials */}
          {YEAR.map((mo, i) => {
            const [x, y] = polar(200, 200, 156, i * 30 + 15);
            const on = i === active;
            return (
              <text
                key={mo.short}
                x={x} y={y}
                textAnchor="middle" dominantBaseline="central"
                className="pointer-events-none select-none"
                style={{
                  fontSize: 13,
                  fontWeight: on ? 700 : 500,
                  fill: on ? "#f6f3e9" : "#2e4a1c",
                }}
              >
                {mo.short}
              </text>
            );
          })}

          <circle cx="200" cy="200" r="120" fill="#fffdf7" stroke="#e2dfd2" />

          <text x="200" y="172" textAnchor="middle"
            style={{ fontSize: 11, letterSpacing: 2, fill: "#4a7c2f", fontWeight: 600 }}>
            {m.short.toUpperCase()}
          </text>
          <foreignObject x="90" y="182" width="220" height="90">
            <div className="text-center">
              <p className="font-display text-[22px] leading-tight text-forest">
                {m.phase}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {touched ? "Pick another month" : "Hover to explore"}
              </p>
            </div>
          </foreignObject>
        </svg>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
          {m.name}
        </p>
        <h3 className="mt-2 font-display text-2xl text-forest sm:text-3xl">
          What happens on your estate
        </h3>
        <ul className="mt-6 space-y-3">
          {m.work.map((w) => (
            <li
              key={w}
              className="flex animate-fade-up items-start gap-3 text-body"
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-moss" />
              {w}
            </li>
          ))}
        </ul>
        <p className="mt-7 max-w-sm text-sm leading-relaxed text-muted">
          Cardamom does not wait. Every one of these has a window, and missing it
          costs a season. Running to the calendar is most of the job.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* What you're told vs what you can see                                       */
/* -------------------------------------------------------------------------- */

export function ToldVsSeen() {
  const [seen, setSeen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flip once on its own so the point lands even if nobody clicks.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer.current = setTimeout(() => setSeen(true), 2200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
  };

  return (
    <div>
      <div
        className="inline-flex rounded-full border border-line bg-surface p-1"
        role="tablist"
        aria-label="Compare how estate work is reported"
      >
        {[
          { k: false, label: "What you're told" },
          { k: true, label: "What you can see" },
        ].map((t) => (
          <button
            key={String(t.k)}
            type="button"
            role="tab"
            aria-selected={seen === t.k}
            onClick={() => {
              stop();
              setSeen(t.k);
            }}
            className={cn(
              "rounded-full px-4 py-2 text-sm transition-colors",
              seen === t.k
                ? "bg-forest font-medium text-cream"
                : "text-body hover:text-forest",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative mt-6 min-h-[340px]">
        {/* Told */}
        <div
          className={cn(
            "transition-all duration-500",
            seen
              ? "pointer-events-none absolute inset-0 translate-y-2 opacity-0"
              : "translate-y-0 opacity-100",
          )}
          aria-hidden={seen}
        >
          <div className="rounded-[--radius-card] border border-line bg-surface p-6">
            <div className="flex items-center gap-2 text-xs text-muted">
              <MessageCircle className="size-3.5" /> A message, some time later
            </div>
            <div className="mt-5 max-w-xs rounded-2xl rounded-tl-sm bg-tint px-4 py-3 text-body">
              Spraying is over. Everything is fine, no problem.
            </div>
            <div className="mt-3 max-w-xs rounded-2xl rounded-tl-sm bg-tint px-4 py-3 text-body">
              Harvest was good this round 👍
            </div>
            <ul className="mt-7 space-y-2 text-sm text-muted">
              <li>Which spray? What dose? On which block?</li>
              <li>Good compared to what?</li>
              <li>What did it cost?</li>
              <li>And in six months, where is any of this?</li>
            </ul>
          </div>
        </div>

        {/* Seen */}
        <div
          className={cn(
            "transition-all duration-500",
            seen
              ? "translate-y-0 opacity-100"
              : "pointer-events-none absolute inset-0 translate-y-2 opacity-0",
          )}
          aria-hidden={!seen}
        >
          <div className="rounded-[--radius-card] border-2 border-moss/40 bg-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-lg text-forest">
                  Spraying — upper block
                </p>
                <p className="text-xs text-muted">
                  9 July · Recorded on the estate at 11:24
                </p>
              </div>
              <span className="rounded-full bg-tint px-3 py-1 text-[11px] font-medium text-forest">
                Plant protection
              </span>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg bg-gradient-to-br from-tint to-sage/40"
                />
              ))}
            </div>

            <dl className="mt-4 space-y-1.5 text-sm">
              {[
                ["Material", "Quinalphos 25 EC · 400 ml"],
                ["Water", "200 L, two tanks"],
                ["Workers", "3 · ₹1,650"],
                ["Total cost", "₹2,340"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-4 border-b border-line-soft pb-1.5 last:border-0"
                >
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium text-forest">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-moss">
              <span className="inline-flex items-center gap-1.5">
                <Camera className="size-3.5" /> 4 photographs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" /> Named workers
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IndianRupee className="size-3.5" /> Itemised
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5" /> Kept for good
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
