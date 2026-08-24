/**
 * Product illustrations for the store.
 *
 * The originals were auto-generated stand-ins: a flat background, a white
 * circle, a few hard-edged ellipses sharing one stroke, and the product name
 * baked into the artwork. All four products got near-identical pictures, so the
 * grid read as "images pending" rather than as a shop.
 *
 * These are drawn as a set instead. One staging treatment across every frame —
 * same square, same light from the top left, same ground shadow, same warm
 * vignette — so the grid holds together, while each product gets a silhouette
 * that is legible at thumbnail size: big capsules, a scattered handful, a heap
 * of loose seed, a mound of powder. No text in the artwork; the page says the
 * name.
 *
 * Palette is the site's own (globals.css). Everything is self-contained —
 * gradients and filters only, no scripts, no external references — because
 * these are served out of /uploads, which next.config.ts sandboxes.
 *
 * Run: node scripts/draw-products.mjs
 */
import { writeFile } from "node:fs/promises";

const SIZE = 900;

/* Deterministic noise, so re-running produces byte-identical files rather than
   a fresh random scatter every time. */
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (v) => Math.round(v * 100) / 100;

/* -------------------------------------------------------------------------- */
/* Shared staging                                                              */
/* -------------------------------------------------------------------------- */

/* Cured cardamom is a pale, distinctly yellow-green — closer to the site's sage
   than to its forest. The first pass sat too blue and too dark, which read as
   olives. */
const TONES = {
  deep: { lit: "#aec572", mid: "#8aa94d", dark: "#5f7f2c", edge: "#4a6522" },
  mid: { lit: "#c0d489", mid: "#9dba63", dark: "#72933d", edge: "#57742b" },
  pale: { lit: "#d2e0a4", mid: "#b3ca80", dark: "#8aa856", edge: "#6a8639" },
};

function defs() {
  const podGrads = Object.entries(TONES)
    .map(
      ([key, t]) => `
    <linearGradient id="pod-${key}" x1="0" y1="0" x2="1" y2="0.35">
      <stop offset="0" stop-color="${t.lit}"/>
      <stop offset="0.42" stop-color="${t.mid}"/>
      <stop offset="1" stop-color="${t.dark}"/>
    </linearGradient>`,
    )
    .join("");

  return `<defs>
    <radialGradient id="ground" cx="0.38" cy="0.3" r="0.86">
      <stop offset="0" stop-color="#f7f4e8"/>
      <stop offset="0.55" stop-color="#eef0dd"/>
      <stop offset="1" stop-color="#dde7ce"/>
    </radialGradient>
    ${podGrads}
    <linearGradient id="cavity" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5a4630"/>
      <stop offset="1" stop-color="#2f2417"/>
    </linearGradient>
    <linearGradient id="seed" x1="0.2" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#4b3b28"/>
      <stop offset="1" stop-color="#241b12"/>
    </linearGradient>
    <linearGradient id="powder" x1="0.2" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="#d8dcab"/>
      <stop offset="0.5" stop-color="#b9c084"/>
      <stop offset="1" stop-color="#8e9860"/>
    </linearGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0.55" stop-color="#2e4a1c" stop-opacity="0"/>
      <stop offset="1" stop-color="#2e4a1c" stop-opacity="0.13"/>
    </radialGradient>
    <filter id="cast" x="-45%" y="-45%" width="190%" height="190%">
      <feGaussianBlur stdDeviation="17"/>
    </filter>
    <filter id="soft" x="-45%" y="-45%" width="190%" height="190%">
      <feGaussianBlur stdDeviation="7"/>
    </filter>
    <filter id="dust" x="-45%" y="-45%" width="190%" height="190%">
      <feGaussianBlur stdDeviation="13"/>
    </filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>`;
}

const backdrop = `<rect width="${SIZE}" height="${SIZE}" fill="url(#ground)"/>`;
const finish = `<rect width="${SIZE}" height="${SIZE}" fill="url(#vignette)"/>
  <rect width="${SIZE}" height="${SIZE}" filter="url(#grain)" opacity="0.045"/>`;

/** Blurred contact shadow, drawn under a subject so it sits rather than floats. */
function cast(cx, cy, rx, ry, opacity = 0.2) {
  return `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="#3d5220" opacity="${opacity}" filter="url(#cast)"/>`;
}

/* -------------------------------------------------------------------------- */
/* A cardamom capsule                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The capsule outline. A cardamom pod is not a lens — it is an egg drawn to a
 * beak at the stem end and blunt at the other, widest about two thirds of the
 * way down. Drawing it symmetrically pointed (as the first pass did) reads as a
 * leaf at thumbnail size, which is the one thing this must not look like.
 */
function capsule(w, h) {
  return [
    `M 0 ${n(-h)}`,
    `C ${n(w * 0.54)} ${n(-h * 0.74)} ${n(w * 1.08)} ${n(-h * 0.04)} ${n(w * 0.96)} ${n(h * 0.34)}`,
    `C ${n(w * 0.88)} ${n(h * 0.76)} ${n(w * 0.48)} ${n(h)} 0 ${n(h)}`,
    `C ${n(-w * 0.48)} ${n(h)} ${n(-w * 0.88)} ${n(h * 0.76)} ${n(-w * 0.96)} ${n(h * 0.34)}`,
    `C ${n(-w * 1.08)} ${n(-h * 0.04)} ${n(-w * 0.54)} ${n(-h * 0.74)} 0 ${n(-h)}`,
    "Z",
  ].join(" ");
}

/**
 * A whole capsule: ribbed, lit from the top left, with a dry stem at the beak
 * and a scar at the base. Volume comes from the gradient plus a blurred
 * highlight and a blurred core shadow — what the flat originals were missing.
 */
function pod({ x, y, len, rot = 0, tone = "mid", seed = 1 }) {
  const t = TONES[tone];
  const w = len * 0.31;
  const h = len / 2;
  const r = rng(seed);

  const body = capsule(w, h);

  // Three main ribs plus finer striations between them. They start below the
  // beak and die out before the base, following the widest part of the body
  // rather than running tip to tip.
  const ribs = [0.46, 0.22, 0, -0.22, -0.46]
    .map((f) => {
      const major = f === 0 || Math.abs(f) === 0.46;
      const x0 = w * f;
      const bulge = w * f * 1.32;
      return `<path d="M ${n(x0 * 0.5)} ${n(-h * 0.52)} Q ${n(bulge)} ${n(h * 0.2)} ${n(x0 * 0.62)} ${n(h * 0.78)}" fill="none" stroke="${t.edge}" stroke-width="${major ? 1.9 : 1.1}" opacity="${major ? 0.32 : 0.17}" stroke-linecap="round"/>`;
    })
    .join("");

  const wobble = (r() - 0.5) * 3;

  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rot + wobble)})">
    <path d="${body}" fill="url(#pod-${tone})" stroke="${t.edge}" stroke-width="1.6" stroke-opacity="0.5"/>
    <ellipse cx="${n(-w * 0.34)}" cy="${n(h * 0.06)}" rx="${n(w * 0.28)}" ry="${n(h * 0.42)}" fill="#ffffff" opacity="0.22" filter="url(#soft)"/>
    ${ribs}
    <ellipse cx="${n(w * 0.3)}" cy="${n(h * 0.34)}" rx="${n(w * 0.5)}" ry="${n(h * 0.44)}" fill="${t.edge}" opacity="0.15" filter="url(#soft)"/>
    <path d="M 0 ${n(-h + len * 0.012)} L ${n(w * 0.07)} ${n(-h - len * 0.055)}" stroke="#907149" stroke-width="${n(len * 0.036)}" stroke-linecap="round"/>
    <ellipse cx="0" cy="${n(h - len * 0.02)}" rx="${n(w * 0.14)}" ry="${n(len * 0.016)}" fill="#6f5c30" opacity="0.55"/>
  </g>`;
}

/** A capsule split open, showing the seed column inside. */
function podOpen({ x, y, len, rot = 0, tone = "pale" }) {
  const t = TONES[tone];
  const w = len * 0.33;
  const h = len / 2;

  const husk = capsule(w, h);
  const cw = w * 0.58;
  const ch = h * 0.8;
  const cavity = capsule(cw, ch);

  // Two staggered columns of seed, the way they actually pack in the capsule.
  let seeds = "";
  const rows = 7;
  for (let i = 0; i < rows; i++) {
    const ty = -ch * 0.72 + (i * (ch * 1.44)) / (rows - 1);
    const taper = 1 - Math.abs(i - (rows - 1) / 2) / ((rows - 1) / 2) * 0.45;
    const sx = cw * 0.34 * taper;
    const rx = cw * 0.4 * taper;
    const ry = ch * 0.1 * taper;
    seeds += `<ellipse cx="${n(-sx)}" cy="${n(ty)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#seed)"/>`;
    seeds += `<ellipse cx="${n(sx)}" cy="${n(ty + ch * 0.06)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#seed)" opacity="0.92"/>`;
  }

  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rot)})">
    <path d="${husk}" fill="url(#pod-${tone})" stroke="${t.edge}" stroke-width="1.6" stroke-opacity="0.5"/>
    <ellipse cx="${n(-w * 0.34)}" cy="${n(h * 0.05)}" rx="${n(w * 0.24)}" ry="${n(h * 0.4)}" fill="#ffffff" opacity="0.18" filter="url(#soft)"/>
    <g transform="translate(0 ${n(h * 0.08)})">
      <path d="${cavity}" fill="url(#cavity)"/>
      <path d="${cavity}" fill="none" stroke="${t.edge}" stroke-width="2" opacity="0.5"/>
      ${seeds}
    </g>
    <path d="M 0 ${n(-h + len * 0.012)} L ${n(w * 0.07)} ${n(-h - len * 0.055)}" stroke="#907149" stroke-width="${n(len * 0.034)}" stroke-linecap="round"/>
  </g>`;
}

/** A single loose seed. */
function seedGrain({ x, y, r: size, rot = 0, opacity = 1 }) {
  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rot)})">
    <ellipse cx="0" cy="0" rx="${n(size)}" ry="${n(size * 0.78)}" fill="url(#seed)" opacity="${opacity}"/>
    <ellipse cx="${n(-size * 0.26)}" cy="${n(-size * 0.28)}" rx="${n(size * 0.3)}" ry="${n(size * 0.2)}" fill="#ffffff" opacity="${0.16 * opacity}"/>
    <path d="M ${n(-size * 0.5)} ${n(size * 0.1)} Q 0 ${n(size * 0.45)} ${n(size * 0.5)} ${n(size * 0.1)}" fill="none" stroke="#170f09" stroke-width="${n(size * 0.13)}" opacity="${0.4 * opacity}"/>
  </g>`;
}

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img" aria-label="">
${defs()}
${backdrop}
${body}
${finish}
</svg>
`;

/* -------------------------------------------------------------------------- */
/* The four products                                                           */
/* -------------------------------------------------------------------------- */

/** Extra Bold — the 8 mm grade, so the capsules are drawn large and few. */
function extraBoldHero() {
  return svg(
    [
      cast(452, 622, 268, 48, 0.22),
      // Wider than it is tall, and weighted toward the horizontal. An upright
      // radiating cluster — even an asymmetric one — reads as a succulent
      // rosette at thumbnail size; pods lying across each other read as a
      // handful tipped onto a table, which is what this is.
      pod({ x: 372, y: 470, len: 250, rot: -63, tone: "pale", seed: 3 }),
      pod({ x: 566, y: 458, len: 238, rot: 78, tone: "pale", seed: 7 }),
      pod({ x: 468, y: 452, len: 262, rot: 14, tone: "mid", seed: 5 }),
      pod({ x: 262, y: 560, len: 286, rot: -84, tone: "mid", seed: 11 }),
      pod({ x: 664, y: 552, len: 278, rot: 71, tone: "deep", seed: 13 }),
      pod({ x: 392, y: 578, len: 316, rot: -37, tone: "deep", seed: 17 }),
      pod({ x: 556, y: 592, len: 306, rot: 42, tone: "mid", seed: 19 }),
      pod({ x: 470, y: 610, len: 292, rot: -9, tone: "deep", seed: 23 }),
    ].join("\n"),
  );
}

/** Extra Bold, second frame — one capsule opened, so the seed shows. */
function extraBoldDetail() {
  return svg(
    [
      cast(462, 700, 210, 42, 0.2),
      pod({ x: 322, y: 486, len: 392, rot: -11, tone: "deep", seed: 21 }),
      podOpen({ x: 596, y: 508, len: 366, rot: 13, tone: "pale" }),
      seedGrain({ x: 452, y: 738, r: 17, rot: 20 }),
      seedGrain({ x: 508, y: 758, r: 15, rot: -35 }),
      seedGrain({ x: 564, y: 742, r: 16, rot: 62 }),
    ].join("\n"),
  );
}

/** Bold — the everyday 7 mm grade: a looser, fuller handful. */
function bold() {
  const r = rng(99);
  const placed = [
    [286, 400, 196, -68, "pale"],
    [472, 372, 186, 104, "pale"],
    [636, 402, 192, 71, "pale"],
    [370, 470, 226, -32, "mid"],
    [560, 462, 232, 36, "mid"],
    [266, 578, 218, -84, "mid"],
    [656, 584, 214, 88, "deep"],
    [378, 620, 258, -14, "deep"],
    [540, 628, 252, 17, "deep"],
    [458, 660, 236, 2, "mid"],
  ];
  return svg(
    [
      cast(452, 664, 276, 58, 0.2),
      ...placed.map(([x, y, len, rot, tone], i) =>
        pod({ x, y, len, rot: rot + (r() - 0.5) * 6, tone, seed: 40 + i * 7 }),
      ),
    ].join("\n"),
  );
}

/** Decorticated seed — no husk at all, so the silhouette is a loose heap. */
function seeds() {
  const r = rng(1234);

  // Grains are packed between a mound profile and the base line, then painted
  // back to front, so the pile has a silhouette and a front face instead of
  // being one scattered layer. Filling the frame to roughly the same width as
  // the pod images keeps the four thumbnails at a consistent scale.
  const CX = 452;
  const BASE = 664;
  const SPAN = 258;
  const PEAK = 184;

  const grains = [];
  for (let i = 0; i < 420; i++) {
    const u = (r() * 2 - 1) * SPAN;
    const x = CX + u;
    // Semi-ellipse: a loose heap slumps into a low dome, not a cone.
    const profile = BASE - PEAK * Math.sqrt(Math.max(0, 1 - (u / SPAN) ** 2));
    // The foot of the pile bows down slightly at the centre, so the heap rests
    // on the surface rather than being sliced off flat along the bottom.
    const foot = BASE + 12 * (1 - (u / SPAN) ** 2);
    const y = profile + r() * (foot - profile) + (r() - 0.5) * 18;
    if (y > foot + 8) continue;
    // Grains nearer the front of the pile sit lower and read slightly larger.
    const depth = (y - profile) / Math.max(1, foot - profile);
    grains.push({ x, y, size: 15 + depth * 8 + r() * 4, rot: r() * 180 });
  }
  grains.sort((a, b) => a.y - b.y);

  const loose = [
    seedGrain({ x: 214, y: 702, r: 16, rot: 24, opacity: 0.95 }),
    seedGrain({ x: 690, y: 692, r: 17, rot: -48, opacity: 0.95 }),
    seedGrain({ x: 300, y: 730, r: 14, rot: 70, opacity: 0.9 }),
    seedGrain({ x: 604, y: 738, r: 15, rot: -12, opacity: 0.9 }),
  ];

  return svg(
    [
      cast(452, 676, 262, 38, 0.26),
      ...grains.map((g) => seedGrain({ x: g.x, y: g.y, r: g.size, rot: g.rot })),
      ...loose,
    ].join("\n"),
  );
}

/** Ground powder — a soft mound with a dusty edge and a scatter of fines. */
function powder() {
  const r = rng(77);
  const CX = 452;
  const BASE = 664;
  const SPAN = 244;
  const PEAK = 176;

  const profileAt = (u) => BASE - PEAK * Math.sqrt(Math.max(0, 1 - (u / SPAN) ** 2));

  // Same dome as the seed heap, so the two "loose goods" thumbnails are
  // obviously the same product line photographed the same way.
  const mound = `<path d="M ${CX - SPAN} ${BASE} A ${SPAN} ${PEAK} 0 0 1 ${CX + SPAN} ${BASE} Z" fill="url(#powder)"/>`;

  // Grind texture: speckles scattered inside the dome, denser and darker toward
  // the shaded right, which is what stops it reading as a flat wedge of colour.
  const specks = [];
  for (let i = 0; i < 420; i++) {
    const u = (r() * 2 - 1) * SPAN * 0.97;
    const top = profileAt(u);
    const y = top + 5 + r() * Math.max(2, BASE - top - 7);
    const shade = (u / SPAN + 1) / 2;
    const size = 1.4 + r() * 3.2;
    specks.push(
      `<circle cx="${n(CX + u)}" cy="${n(y)}" r="${n(size)}" fill="${r() < 0.35 + shade * 0.3 ? "#7c8a4e" : "#e8ecc6"}" opacity="${n(0.18 + r() * 0.32)}"/>`,
    );
  }

  const lit = `<ellipse cx="${CX - 78}" cy="${BASE - 108}" rx="112" ry="72" fill="#ffffff" opacity="0.24" filter="url(#dust)"/>`;
  const rim = `<path d="M ${CX - SPAN} ${BASE} A ${SPAN} ${PEAK} 0 0 1 ${CX + SPAN} ${BASE}" fill="none" stroke="#8b9459" stroke-width="3" opacity="0.35"/>`;
  const foot = `<ellipse cx="${CX}" cy="${BASE}" rx="${SPAN}" ry="20" fill="#96a069" opacity="0.45"/>`;
  // A little of the grind spilled at the foot, so the edge is not a clean arc.
  const spill = [];
  for (let i = 0; i < 90; i++) {
    const u = (r() * 2 - 1) * (SPAN + 66);
    const y = BASE + 4 + r() * 34;
    spill.push(
      `<circle cx="${n(CX + u)}" cy="${n(y)}" r="${n(1.2 + r() * 2.6)}" fill="#9aa46c" opacity="${n(0.12 + r() * 0.3)}"/>`,
    );
  }

  return svg(
    [
      cast(452, 676, 250, 34, 0.2),
      mound,
      lit,
      ...specks,
      rim,
      foot,
      ...spill,
      // Two whole capsules lying in front of the mound — not tucked behind it,
      // where a symmetric pair reads as a pair of ears.
      pod({ x: 286, y: 692, len: 196, rot: -73, tone: "mid", seed: 91 }),
      pod({ x: 604, y: 714, len: 168, rot: 101, tone: "pale", seed: 93 }),
    ].join("\n"),
  );
}

/* product-1 and -2 are the two frames of Extra Bold; -3 Bold; -4 seed;
   -5 powder. The filenames are what the seed data already points at. */
const FILES = [
  ["public/uploads/product-1.svg", extraBoldHero()],
  ["public/uploads/product-2.svg", extraBoldDetail()],
  ["public/uploads/product-3.svg", bold()],
  ["public/uploads/product-4.svg", seeds()],
  ["public/uploads/product-5.svg", powder()],
];

for (const [path, contents] of FILES) {
  await writeFile(path, contents, "utf8");
  console.log(`${path}  ${(contents.length / 1024).toFixed(1)} KB`);
}
