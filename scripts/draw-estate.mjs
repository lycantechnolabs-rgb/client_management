/**
 * Estate imagery for the gallery, the about page and the seeded activity
 * attachments.
 *
 * Like the product art, the originals were one generated template repeated
 * twelve times — the same two hill bands and the same pod ellipse — so nine
 * "different" gallery shots were visibly the same picture. The page carried a
 * footnote apologising for it.
 *
 * These are drawn as a set of scenes instead, one per caption. Shared staging
 * holds them together: a single light direction, layered depth with the far
 * planes washed toward the sky (atmospheric perspective is what sells distance
 * in flat vector), and the same grain and vignette finish as the product art.
 *
 * CROPPING. The source is 1200x800, but these are rendered at 16:9 (about
 * hero), 4:3 (gallery) and 1:1 (about strip, dashboard thumbnails). A square
 * crop keeps only the middle 800px and 16:9 trims 62px off the top and bottom,
 * so the region that survives every crop is x 200–1000, y 63–737. Each scene
 * keeps its subject inside that; nothing that matters goes near a corner.
 *
 * Run: node scripts/draw-estate.mjs
 */
import { writeFile } from "node:fs/promises";

const W = 1200;
const H = 800;

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

const n = (v) => Math.round(v * 10) / 10;
const mix = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return (
    "#" +
    pa
      .map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0"))
      .join("")
  );
};

/* -------------------------------------------------------------------------- */
/* Light                                                                       */
/* -------------------------------------------------------------------------- */

/** Four times of day. `haze` is the colour distant planes wash toward. */
const LIGHT = {
  dawn: {
    skyTop: "#e9e3cd",
    skyLow: "#f6ecd8",
    haze: "#eee7d2",
    sun: "#f7dfae",
    sunAt: [890, 250],
    leaf: ["#5f8038", "#7fa353", "#9dbb6f"],
    ground: "#93ac72",
    shadow: "#3d5220",
  },
  day: {
    skyTop: "#d6e4c9",
    skyLow: "#eef2e0",
    haze: "#e4ecd8",
    sun: "#f4f0d8",
    sunAt: [820, 190],
    leaf: ["#4a6f28", "#6f9440", "#93b45f"],
    ground: "#8aa568",
    shadow: "#33501a",
  },
  shade: {
    skyTop: "#c2d4b4",
    skyLow: "#dbe6cc",
    haze: "#d4e0c6",
    sun: "#e8f0d6",
    sunAt: [760, 150],
    leaf: ["#3f6122", "#5d8235", "#7ba053"],
    ground: "#6f8a52",
    shadow: "#2b4416",
  },
  evening: {
    skyTop: "#e2d4b6",
    skyLow: "#f4e2c0",
    haze: "#eaddc0",
    sun: "#f0c98a",
    sunAt: [300, 280],
    leaf: ["#4a5f2c", "#67813d", "#879c58"],
    ground: "#8a9264",
    shadow: "#3a3f1e",
  },
};

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                               */
/* -------------------------------------------------------------------------- */

function defs(L) {
  return `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${L.skyTop}"/>
      <stop offset="1" stop-color="${L.skyLow}"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${L.sun}" stop-opacity="0.95"/>
      <stop offset="1" stop-color="${L.sun}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${mix(L.ground, L.haze, 0.45)}"/>
      <stop offset="1" stop-color="${mix(L.ground, "#2e4a1c", 0.3)}"/>
    </linearGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.78">
      <stop offset="0.5" stop-color="#2e4a1c" stop-opacity="0"/>
      <stop offset="1" stop-color="#2e4a1c" stop-opacity="0.16"/>
    </radialGradient>
    <filter id="blur6" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
    <filter id="blur16" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="16"/>
    </filter>
    <filter id="blur34" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="34"/>
    </filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>`;
}

const finish = `<rect width="${W}" height="${H}" fill="url(#vignette)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.05"/>`;

function sky(L) {
  const [sx, sy] = L.sunAt;
  return `<rect width="${W}" height="${H}" fill="url(#sky)"/>
  <ellipse cx="${sx}" cy="${sy}" rx="380" ry="300" fill="url(#sun)"/>`;
}

/**
 * A hill silhouette. Distance is passed as 0..1 and washes the colour toward
 * the sky — the further layer is always the paler one, which is the whole
 * trick for reading depth without perspective lines.
 */
function ridge(L, { base, amp, seed, distance, tint }) {
  const r = rng(seed);
  const phase = r() * 6;
  const pts = [];
  for (let x = -60; x <= W + 60; x += 60) {
    const t = x / W;
    const y =
      base -
      amp * (0.55 * Math.sin(t * 4.1 + phase) + 0.45 * Math.sin(t * 7.7 + phase * 1.7));
    pts.push(`${n(x)} ${n(y)}`);
  }
  const fill = mix(tint ?? L.ground, L.haze, distance);
  return `<path d="M ${pts.join(" L ")} L ${W + 60} ${H} L -60 ${H} Z" fill="${fill}"/>`;
}

function mistBand(L, y, height, opacity = 0.5) {
  return `<rect x="-40" y="${n(y)}" width="${W + 80}" height="${n(height)}" fill="${L.haze}" opacity="${opacity}" filter="url(#blur34)"/>`;
}

/**
 * One lance-shaped cardamom leaf, lying along +x from the origin. `bend` drops
 * the tip: the blades arch over under their own weight, and drawing them dead
 * straight is what made the first pass look like bamboo.
 */
function leaf(len, wid, colour, bend = 0, opacity = 1) {
  const d = [
    "M 0 0",
    `C ${n(len * 0.3)} ${n(-wid)} ${n(len * 0.72)} ${n(bend * 0.45 - wid * 0.82)} ${n(len)} ${n(bend)}`,
    `C ${n(len * 0.72)} ${n(bend * 0.45 + wid * 0.82)} ${n(len * 0.3)} ${n(wid)} 0 0`,
    "Z",
  ].join(" ");
  const rib = `M ${n(len * 0.06)} 0 Q ${n(len * 0.6)} ${n(bend * 0.32)} ${n(len * 0.94)} ${n(bend * 0.9)}`;
  return `<path d="${d}" fill="${colour}" opacity="${opacity}"/><path d="${rib}" fill="none" stroke="#2e4a1c" stroke-width="${n(wid * 0.11)}" opacity="${0.2 * opacity}"/>`;
}

/**
 * A cardamom clump: two or three pseudostems, each carrying long leaves that
 * alternate down either side and droop as they go up. This is the motif that
 * makes an estate read as cardamom rather than as generic greenery.
 */
function clump({ x, y, s = 1, L, distance = 0, seed = 1, lean = 0 }) {
  const r = rng(seed);
  const stems = 2 + Math.floor(r() * 2);
  const drawn = [];

  for (let i = 0; i < stems; i++) {
    const sx = (i - (stems - 1) / 2) * 30 * s + (r() - 0.5) * 12 * s;
    const height = (150 + r() * 52) * s;
    const tilt = (r() - 0.5) * 10;
    const shade = mix(L.leaf[i % L.leaf.length], L.haze, distance);
    // The cane is mostly hidden by its own foliage — only a thin line shows.
    const parts = [
      `<path d="M 0 0 Q ${n(height * 0.05)} ${n(-height * 0.55)} ${n(height * 0.09)} ${n(-height * 0.92)}" fill="none" stroke="${mix("#4d6b2c", L.haze, distance)}" stroke-width="${n(3.4 * s)}" stroke-linecap="round"/>`,
    ];

    const blades = 8 + Math.floor(r() * 3);
    for (let j = 0; j < blades; j++) {
      const up = 0.12 + (j / blades) * 0.9;
      const ly = -height * up;
      const lx = height * 0.09 * up;
      const side = j % 2 === 0 ? 1 : -1;
      // Long blades relative to the cane: a cardamom clump is mostly leaf.
      const len = (112 + r() * 62) * s * (1.02 - up * 0.2);
      const wid = len * (0.13 + r() * 0.035);
      const bend = len * (0.2 + r() * 0.16);
      // Lower leaves lie out near horizontal, upper ones rise — the outline
      // becomes a fountain rather than a starburst.
      const angle = 10 + (1 - up) * 40 + r() * 12;
      // Left-hand blades are the right-hand blade mirrored, so both sides droop
      // downward. Rotating by 180-angle instead flips the arch upward.
      const flip = side > 0 ? "" : " scale(-1 1)";
      parts.push(
        `<g transform="translate(${n(lx)} ${n(ly)})${flip} rotate(${n(angle)})">${leaf(len, wid, shade, bend, 1)}</g>`,
      );
    }

    drawn.push(
      `<g transform="translate(${n(sx)} 0) rotate(${n(tilt)})">${parts.join("")}</g>`,
    );
  }

  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(lean * 0.15)})">
    <ellipse cx="0" cy="6" rx="${n(72 * s)}" ry="${n(14 * s)}" fill="${L.shadow}" opacity="${n(0.22 * (1 - distance))}" filter="url(#blur16)"/>
    ${drawn.join("")}
  </g>`;
}

/** A shade tree: bare trunk to a high, open canopy. */
function tree({ x, y, s = 1, L, distance = 0.3, seed = 2 }) {
  const r = rng(seed);
  const h = 340 * s;
  const trunk = mix("#6b5a3c", L.haze, distance * 0.8);
  const canopy = mix(L.leaf[0], L.haze, distance);
  const blobs = [];
  for (let i = 0; i < 7; i++) {
    const bx = (r() - 0.5) * 210 * s;
    const by = -h - (r() * 70 - 20) * s;
    const br = (58 + r() * 46) * s;
    blobs.push(
      `<ellipse cx="${n(bx)}" cy="${n(by)}" rx="${n(br)}" ry="${n(br * 0.72)}" fill="${canopy}" opacity="${n(0.8 + r() * 0.2)}"/>`,
    );
  }
  return `<g transform="translate(${n(x)} ${n(y)})">
    <path d="M ${n(-9 * s)} 0 Q ${n(-4 * s)} ${n(-h * 0.5)} ${n(-5 * s)} ${n(-h)} L ${n(5 * s)} ${n(-h)} Q ${n(6 * s)} ${n(-h * 0.5)} ${n(9 * s)} 0 Z" fill="${trunk}"/>
    <path d="M ${n(-5 * s)} ${n(-h * 0.78)} L ${n(-52 * s)} ${n(-h * 0.98)}" stroke="${trunk}" stroke-width="${n(5 * s)}" stroke-linecap="round"/>
    <path d="M ${n(5 * s)} ${n(-h * 0.82)} L ${n(48 * s)} ${n(-h * 1.02)}" stroke="${trunk}" stroke-width="${n(5 * s)}" stroke-linecap="round"/>
    ${blobs.join("")}
  </g>`;
}

/** A ripe capsule, for the close-up scenes. */
function capsule({ x, y, len = 34, rot = 0, colour = "#8fae57", edge = "#5c7d2f" }) {
  const w = len * 0.32;
  const h = len / 2;
  const d = `M 0 ${n(-h)} C ${n(w * 0.54)} ${n(-h * 0.74)} ${n(w * 1.08)} ${n(-h * 0.04)} ${n(w * 0.96)} ${n(h * 0.34)} C ${n(w * 0.88)} ${n(h * 0.76)} ${n(w * 0.48)} ${n(h)} 0 ${n(h)} C ${n(-w * 0.48)} ${n(h)} ${n(-w * 0.88)} ${n(h * 0.76)} ${n(-w * 0.96)} ${n(h * 0.34)} C ${n(-w * 1.08)} ${n(-h * 0.04)} ${n(-w * 0.54)} ${n(-h * 0.74)} 0 ${n(-h)} Z`;
  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rot)})">
    <path d="${d}" fill="${colour}" stroke="${edge}" stroke-width="1.2" stroke-opacity="0.5"/>
    <path d="M 0 ${n(-h * 0.5)} L 0 ${n(h * 0.72)}" stroke="${edge}" stroke-width="1.1" opacity="0.32"/>
    <path d="M 0 ${n(-h)} l ${n(w * 0.1)} ${n(-len * 0.06)}" stroke="#8a6a38" stroke-width="${n(len * 0.045)}" stroke-linecap="round"/>
  </g>`;
}

/** Ground plane with a soft horizon join. */
function floor(y) {
  return `<path d="M -40 ${n(y)} Q ${W / 2} ${n(y - 26)} ${W + 40} ${n(y)} L ${W + 40} ${H} L -40 ${H} Z" fill="url(#floor)"/>`;
}

const svg = (L, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="">
${defs(L)}
${sky(L)}
${body}
${finish}
</svg>
`;

/** A receding row of clumps, smaller and hazier toward the back. */
function row({ L, y, count, s, distance, seed, spread = W + 200 }) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const x = -100 + (spread / (count - 1)) * i + (r() - 0.5) * 40;
    out.push(
      clump({
        x,
        y: y + (r() - 0.5) * 12,
        s: s * (0.9 + r() * 0.2),
        L,
        distance,
        seed: seed * 31 + i * 7,
        lean: (r() - 0.5) * 14,
      }),
    );
  }
  return out.join("\n");
}

/* -------------------------------------------------------------------------- */
/* Props                                                                       */
/* -------------------------------------------------------------------------- */

/** Woven basket, used in the harvest scene. */
function basket({ x, y, s = 1, L }) {
  const w = 130 * s;
  const h = 86 * s;
  const weave = [];
  for (let i = 1; i < 5; i++) {
    const yy = -h + (h / 5) * i;
    const t = 1 - (i / 5) * 0.22;
    weave.push(
      `<path d="M ${n(-w * t)} ${n(yy)} Q 0 ${n(yy + 8 * s)} ${n(w * t)} ${n(yy)}" fill="none" stroke="#8a6a3d" stroke-width="${n(3 * s)}" opacity="0.45"/>`,
    );
  }
  const fill = [];
  const r = rng(9);
  for (let i = 0; i < 26; i++) {
    fill.push(
      capsule({
        x: (r() - 0.5) * w * 1.7,
        y: -h - 4 * s + (r() - 0.5) * 22 * s,
        len: 30 * s,
        rot: r() * 180,
        colour: mix("#9dbb6f", L.haze, 0.05),
      }),
    );
  }
  return `<g transform="translate(${n(x)} ${n(y)})">
    <ellipse cx="0" cy="${n(6 * s)}" rx="${n(w * 1.1)}" ry="${n(16 * s)}" fill="${L.shadow}" opacity="0.24" filter="url(#blur16)"/>
    ${fill.join("")}
    <path d="M ${n(-w)} ${n(-h)} Q ${n(-w * 0.86)} 0 ${n(-w * 0.62)} 0 L ${n(w * 0.62)} 0 Q ${n(w * 0.86)} 0 ${n(w)} ${n(-h)} Z" fill="#b08a52"/>
    <path d="M ${n(-w)} ${n(-h)} Q ${n(-w * 0.86)} 0 ${n(-w * 0.62)} 0 L ${n(w * 0.62)} 0 Q ${n(w * 0.86)} 0 ${n(w)} ${n(-h)} Z" fill="#000000" opacity="0.12"/>
    ${weave.join("")}
    <ellipse cx="0" cy="${n(-h)}" rx="${n(w)}" ry="${n(18 * s)}" fill="none" stroke="#9a763f" stroke-width="${n(7 * s)}"/>
  </g>`;
}

/**
 * A stack of drying trays seen slightly from above: each tray is a receding
 * trapezoid of bed plus a front rail, and only the top tray shows its contents
 * because the rest are covered by the tray above. Drawing every tray's contents
 * — as the first pass did — flattens the stack into a ladder.
 */
function trays({ x, y, s = 1, levels = 4 }) {
  const w = 200 * s;
  const depth = 54 * s;
  const gap = 40 * s;
  const rail = 15 * s;
  const out = [];

  for (let i = 0; i < levels; i++) {
    const ty = -i * gap;
    const backW = w - depth * 0.42;
    const bed = `M ${n(-w)} ${n(ty)} L ${n(w)} ${n(ty)} L ${n(backW)} ${n(ty - depth)} L ${n(-backW)} ${n(ty - depth)} Z`;

    const contents = [];
    if (i === levels - 1) {
      const r = rng(400 + i);
      for (let k = 0; k < 90; k++) {
        const t = r();
        const rowW = backW + (w - backW) * t;
        contents.push(
          capsule({
            x: (r() * 2 - 1) * rowW * 0.94,
            y: ty - depth * (1 - t) - 4 * s,
            len: (20 + t * 8) * s,
            rot: r() * 180,
            colour: t > 0.5 ? "#b6c27e" : "#a3b26c",
            edge: "#6f7f45",
          }),
        );
      }
    }

    out.push(`<g>
      <path d="${bed}" fill="${i === levels - 1 ? "#c9a86e" : "#8d7247"}"/>
      ${contents.join("")}
      <rect x="${n(-w)}" y="${n(ty)}" width="${n(w * 2)}" height="${n(rail)}" fill="#b08a52"/>
      <rect x="${n(-w)}" y="${n(ty)}" width="${n(w * 2)}" height="${n(rail)}" fill="#000000" opacity="0.18"/>
      <rect x="${n(-w)}" y="${n(ty)}" width="${n(w * 2)}" height="${n(rail * 0.3)}" fill="#d8b174" opacity="0.5"/>
    </g>`);
  }

  // Corner posts, so the stack has structure holding it up.
  const post = (px) =>
    `<rect x="${n(px - 7 * s)}" y="${n(-levels * gap)}" width="${n(14 * s)}" height="${n(levels * gap + 16 * s)}" fill="#7a6340"/>`;

  return `<g transform="translate(${n(x)} ${n(y)})">
    <ellipse cx="0" cy="${n(14 * s)}" rx="${n(w * 1.15)}" ry="${n(22 * s)}" fill="#2b2416" opacity="0.4" filter="url(#blur16)"/>
    ${post(-w + 6 * s)}
    ${post(w - 6 * s)}
    ${out.join("")}
  </g>`;
}

/* -------------------------------------------------------------------------- */
/* The scenes — one per gallery caption                                        */
/* -------------------------------------------------------------------------- */

/** 1 — the estate block, early morning. Also the about-page hero. */
function estateBlock() {
  const L = LIGHT.dawn;
  return svg(
    L,
    [
      ridge(L, { base: 360, amp: 46, seed: 2, distance: 0.78 }),
      mistBand(L, 330, 90, 0.7),
      ridge(L, { base: 430, amp: 38, seed: 5, distance: 0.55 }),
      Array.from({ length: 7 }, (_, i) =>
        tree({ x: 90 + i * 180, y: 452, s: 0.5, L, distance: 0.5, seed: 20 + i }),
      ).join(""),
      mistBand(L, 415, 70, 0.55),
      floor(470),
      row({ L, y: 528, count: 7, s: 0.5, distance: 0.34, seed: 3 }),
      row({ L, y: 612, count: 6, s: 0.72, distance: 0.16, seed: 8 }),
      row({ L, y: 742, count: 4, s: 1.05, distance: 0, seed: 12 }),
    ].join("\n"),
  );
}

/** 2 — a fertilizer round: opened sacks and granules at the plant base. */
function fertilizerRound() {
  const L = LIGHT.day;
  const r = rng(51);
  const granules = Array.from({ length: 90 }, () => {
    const gx = 600 + (r() - 0.5) * 420;
    const gy = 686 + (r() - 0.5) * 54;
    return `<circle cx="${n(gx)}" cy="${n(gy)}" r="${n(2.2 + r() * 3)}" fill="#d8d2a6" opacity="${n(0.45 + r() * 0.4)}"/>`;
  }).join("");

  const sack = (x, y, s, tilt) => `<g transform="translate(${x} ${y}) rotate(${tilt})">
    <ellipse cx="0" cy="10" rx="${n(86 * s)}" ry="${n(16 * s)}" fill="${L.shadow}" opacity="0.24" filter="url(#blur16)"/>
    <path d="M ${n(-62 * s)} 0 Q ${n(-72 * s)} ${n(-120 * s)} ${n(-30 * s)} ${n(-146 * s)} L ${n(30 * s)} ${n(-146 * s)} Q ${n(72 * s)} ${n(-120 * s)} ${n(62 * s)} 0 Z" fill="#e2dcc4"/>
    <path d="M ${n(-30 * s)} ${n(-146 * s)} Q 0 ${n(-166 * s)} ${n(30 * s)} ${n(-146 * s)}" fill="none" stroke="#c9c2a4" stroke-width="${n(10 * s)}"/>
    <rect x="${n(-40 * s)}" y="${n(-104 * s)}" width="${n(80 * s)}" height="${n(30 * s)}" rx="${n(4 * s)}" fill="#9aa86e" opacity="0.55"/>
  </g>`;

  return svg(
    L,
    [
      ridge(L, { base: 372, amp: 34, seed: 7, distance: 0.72 }),
      Array.from({ length: 5 }, (_, i) =>
        tree({ x: 130 + i * 250, y: 430, s: 0.56, L, distance: 0.46, seed: 30 + i }),
      ).join(""),
      floor(452),
      row({ L, y: 540, count: 6, s: 0.56, distance: 0.3, seed: 4 }),
      row({ L, y: 648, count: 5, s: 0.8, distance: 0.12, seed: 9 }),
      granules,
      clump({ x: 430, y: 726, s: 1.15, L, distance: 0, seed: 61, lean: -6 }),
      sack(760, 706, 1, -4),
      sack(892, 716, 0.82, 7),
    ].join("\n"),
  );
}

/** 3 — checking the panicles: the runners at the base of a clump. */
function panicles() {
  const L = LIGHT.shade;
  const r = rng(77);
  // Runners break out at the base and creep along the ground — six of them,
  // fanning both ways across the lower half where the eye lands.
  const runners = [];
  for (let i = 0; i < 6; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    const spread = 190 + Math.floor(i / 2) * 130;
    const y = 590 + (i % 3) * 52;
    const endY = y + 96;
    runners.push(
      `<path d="M 600 ${n(y)} Q ${n(600 + dir * spread * 0.55)} ${n(y + 74)} ${n(600 + dir * spread)} ${n(endY)}" fill="none" stroke="#5f7d3c" stroke-width="8" stroke-linecap="round"/>`,
    );
    for (let k = 1; k <= 5; k++) {
      const t = k / 5.2;
      const px = 600 + dir * spread * t;
      const py = y + (endY - y) * t * t + 10 * t;
      runners.push(
        capsule({
          x: px,
          y: py,
          len: 46,
          rot: dir * (16 + k * 11),
          colour: k > 3 ? "#93b263" : "#a3c06f",
          edge: "#50702a",
        }),
      );
    }
  }

  return svg(
    L,
    [
      `<rect width="${W}" height="${H}" fill="${mix(L.ground, L.haze, 0.4)}"/>`,
      // Real foliage thrown out of focus, rather than a flat lighter band —
      // a blurred rectangle reads as a wall, blurred leaves read as canopy.
      `<g filter="url(#blur16)" opacity="0.75">
        ${Array.from({ length: 5 }, (_, i) => clump({ x: 60 + i * 280, y: 300, s: 1.1, L, distance: 0.42, seed: 70 + i })).join("")}
      </g>`,
      `<ellipse cx="600" cy="640" rx="620" ry="220" fill="#6d5b3a" opacity="0.35" filter="url(#blur34)"/>`,
      // Leaf trash on the ground under the plant.
      Array.from({ length: 60 }, () => {
        const mx = 600 + (r() - 0.5) * 900;
        const my = 640 + (r() - 0.5) * 220;
        return `<path d="M ${n(mx)} ${n(my)} l ${n(24 + r() * 30)} ${n((r() - 0.5) * 10)}" stroke="#7d6a45" stroke-width="4" stroke-linecap="round" opacity="${n(0.2 + r() * 0.3)}"/>`;
      }).join(""),
      clump({ x: 600, y: 600, s: 1.7, L, distance: 0, seed: 81 }),
      runners.join("\n"),
    ].join("\n"),
  );
}

/** 4 — harvest, a picking round. */
function harvest() {
  const L = LIGHT.day;
  return svg(
    L,
    [
      ridge(L, { base: 360, amp: 32, seed: 11, distance: 0.74 }),
      Array.from({ length: 5 }, (_, i) =>
        tree({ x: 90 + i * 260, y: 424, s: 0.52, L, distance: 0.48, seed: 40 + i }),
      ).join(""),
      floor(448),
      row({ L, y: 536, count: 6, s: 0.54, distance: 0.3, seed: 14 }),
      clump({ x: 250, y: 690, s: 1.05, L, distance: 0.05, seed: 91, lean: -10 }),
      clump({ x: 960, y: 706, s: 1.1, L, distance: 0.05, seed: 93, lean: 12 }),
      basket({ x: 610, y: 716, s: 1.05, L }),
      capsule({ x: 470, y: 742, len: 34, rot: 28, colour: "#9dbb6f" }),
      capsule({ x: 742, y: 750, len: 32, rot: -40, colour: "#93b263" }),
    ].join("\n"),
  );
}

/** 5 — fresh capsules before curing, close up on a mat. */
function freshCapsules() {
  const L = LIGHT.day;
  const r = rng(123);
  const heap = [];
  const CX = 600;
  const BASE = 636;
  const SPAN = 348;
  const PEAK = 188;
  for (let i = 0; i < 300; i++) {
    const u = (r() * 2 - 1) * SPAN;
    const top = BASE - PEAK * Math.sqrt(Math.max(0, 1 - (u / SPAN) ** 2));
    const foot = BASE + 16 * (1 - (u / SPAN) ** 2);
    const y = top + r() * (foot - top);
    heap.push({ x: CX + u, y, len: 40 + r() * 16, rot: r() * 180, t: r() });
  }
  heap.sort((a, b) => a.y - b.y);
  return svg(
    L,
    [
      `<rect width="${W}" height="${H}" fill="${mix(L.ground, L.haze, 0.55)}"/>`,
      // Woven mat under the heap.
      `<ellipse cx="${CX}" cy="${BASE + 30}" rx="470" ry="120" fill="#c9ab74"/>`,
      `<ellipse cx="${CX}" cy="${BASE + 30}" rx="470" ry="120" fill="none" stroke="#a98b58" stroke-width="10" opacity="0.6"/>`,
      Array.from({ length: 9 }, (_, i) => {
        const yy = BASE - 60 + i * 22;
        return `<path d="M ${CX - 460} ${n(yy)} Q ${CX} ${n(yy + 26)} ${CX + 460} ${n(yy)}" fill="none" stroke="#b0925f" stroke-width="3" opacity="0.35"/>`;
      }).join(""),
      `<ellipse cx="${CX}" cy="${BASE + 24}" rx="380" ry="70" fill="${L.shadow}" opacity="0.2" filter="url(#blur34)"/>`,
      heap
        .map((g) =>
          capsule({
            x: g.x,
            y: g.y,
            len: g.len,
            rot: g.rot,
            colour: g.t > 0.55 ? "#a6c076" : g.t > 0.25 ? "#8fae57" : "#7a9c47",
          }),
        )
        .join(""),
    ].join("\n"),
  );
}

/** 6 — the curing house at dusk, smoke going up. */
function curingHouse() {
  const L = LIGHT.evening;
  const smoke = Array.from({ length: 7 }, (_, i) => {
    const t = i / 6;
    return `<ellipse cx="${n(724 + t * 66)}" cy="${n(322 - t * 190)}" rx="${n(26 + t * 54)}" ry="${n(20 + t * 40)}" fill="#e8dcc4" opacity="${n(0.4 - t * 0.32)}" filter="url(#blur16)"/>`;
  }).join("");

  return svg(
    L,
    [
      ridge(L, { base: 372, amp: 38, seed: 17, distance: 0.75 }),
      Array.from({ length: 5 }, (_, i) =>
        tree({ x: 60 + i * 290, y: 452, s: 0.6, L, distance: 0.5, seed: 50 + i }),
      ).join(""),
      floor(476),
      smoke,
      // The shed: low walls, a broad corrugated roof, one lit doorway.
      `<g transform="translate(600 596)">
        <ellipse cx="0" cy="46" rx="330" ry="30" fill="${L.shadow}" opacity="0.26" filter="url(#blur16)"/>
        <rect x="-240" y="-120" width="480" height="166" fill="#a8916d"/>
        <rect x="-240" y="-120" width="480" height="166" fill="#000000" opacity="0.1"/>
        <path d="M -292 -120 L 0 -244 L 292 -120 Z" fill="#8d7c62"/>
        <path d="M -292 -120 L 292 -120 L 292 -104 L -292 -104 Z" fill="#7a6b54"/>
        ${Array.from({ length: 11 }, (_, i) => `<path d="M ${n(-268 + i * 53)} -120 L ${n(-134 + i * 26.6)} -238" stroke="#7a6b54" stroke-width="3" opacity="0.5"/>`).join("")}
        <rect x="-62" y="-72" width="124" height="118" fill="#4a3a24"/>
        <rect x="-62" y="-72" width="124" height="118" fill="#f0c98a" opacity="0.5"/>
        <rect x="-176" y="-84" width="66" height="52" rx="4" fill="#4a3a24" opacity="0.8"/>
        <rect x="112" y="-84" width="66" height="52" rx="4" fill="#4a3a24" opacity="0.8"/>
        <rect x="108" y="-244" width="42" height="52" fill="#8d7c62"/>
      </g>`,
      clump({ x: 176, y: 706, s: 0.95, L, distance: 0.08, seed: 101, lean: -8 }),
      clump({ x: 1040, y: 716, s: 1, L, distance: 0.08, seed: 103, lean: 10 }),
    ].join("\n"),
  );
}

/** 7 — weeded and mulched ground between the clumps. */
function weeding() {
  const L = LIGHT.day;
  const r = rng(207);
  // Cut weed and leaf trash raked between the rows.
  const mulchStrokes = Array.from({ length: 150 }, () => {
    const mx = 600 + (r() - 0.5) * 900;
    const my = 648 + (r() - 0.5) * 170;
    const len = 20 + r() * 38;
    return `<path d="M ${n(mx)} ${n(my)} l ${n(len)} ${n((r() - 0.5) * 10)}" stroke="#9c8558" stroke-width="4" stroke-linecap="round" opacity="${n(0.3 + r() * 0.4)}"/>`;
  }).join("");

  return svg(
    L,
    [
      ridge(L, { base: 368, amp: 30, seed: 23, distance: 0.74 }),
      Array.from({ length: 5 }, (_, i) =>
        tree({ x: 110 + i * 250, y: 430, s: 0.54, L, distance: 0.48, seed: 60 + i }),
      ).join(""),
      floor(454),
      row({ L, y: 546, count: 6, s: 0.56, distance: 0.3, seed: 24 }),
      `<ellipse cx="600" cy="672" rx="520" ry="150" fill="#7d6a45" opacity="0.35" filter="url(#blur34)"/>`,
      mulchStrokes,
      clump({ x: 300, y: 706, s: 1.02, L, distance: 0.04, seed: 111, lean: -9 }),
      clump({ x: 880, y: 716, s: 1.06, L, distance: 0.04, seed: 113, lean: 11 }),
      // A hoe left standing in the cleared ground.
      `<g transform="translate(672 730) rotate(-19)">
        <rect x="-6" y="-268" width="12" height="268" rx="6" fill="#a4854e"/>
        <path d="M -34 -8 L 34 -8 L 26 34 L -26 34 Z" fill="#6d7480"/>
        <path d="M -34 -8 L 34 -8 L 30 6 L -30 6 Z" fill="#565c66"/>
      </g>`,
    ].join("\n"),
  );
}

/** 8 — spraying: the knapsack down, mist still hanging. */
function spraying() {
  const L = LIGHT.shade;
  const mist = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    return `<ellipse cx="${n(430 + t * 420)}" cy="${n(560 - t * 120)}" rx="${n(110 + t * 60)}" ry="${n(56 + t * 34)}" fill="#e6eedd" opacity="${n(0.3 - t * 0.2)}" filter="url(#blur34)"/>`;
  }).join("");

  return svg(
    L,
    [
      ridge(L, { base: 366, amp: 32, seed: 29, distance: 0.72 }),
      Array.from({ length: 5 }, (_, i) =>
        tree({ x: 70 + i * 270, y: 436, s: 0.56, L, distance: 0.48, seed: 70 + i }),
      ).join(""),
      floor(458),
      row({ L, y: 548, count: 6, s: 0.56, distance: 0.3, seed: 31 }),
      row({ L, y: 656, count: 5, s: 0.78, distance: 0.12, seed: 33 }),
      mist,
      clump({ x: 360, y: 730, s: 1.1, L, distance: 0, seed: 121, lean: -7 }),
      // The knapsack sprayer, set down between rows.
      `<g transform="translate(786 722)">
        <ellipse cx="0" cy="12" rx="96" ry="18" fill="${L.shadow}" opacity="0.24" filter="url(#blur16)"/>
        <rect x="-56" y="-158" width="112" height="158" rx="20" fill="#4f7a3a"/>
        <rect x="-56" y="-158" width="112" height="158" rx="20" fill="#000000" opacity="0.12"/>
        <rect x="-34" y="-182" width="68" height="30" rx="10" fill="#3c5c2c"/>
        <path d="M 56 -120 Q 130 -96 140 -20" fill="none" stroke="#2f3d24" stroke-width="9" stroke-linecap="round"/>
        <rect x="132" y="-30" width="14" height="30" rx="6" fill="#2f3d24"/>
        <path d="M -56 -140 Q -104 -80 -70 -8" fill="none" stroke="#3c5c2c" stroke-width="10" fill-opacity="0"/>
      </g>`,
    ].join("\n"),
  );
}

/** 9 — drying trays in the curing shed. */
function dryingTrays() {
  const L = LIGHT.evening;
  return svg(
    L,
    [
      // Shed interior: plank wall, an open doorway throwing light across the
      // stacks from the left.
      `<rect width="${W}" height="${H}" fill="#7d6a4c"/>`,
      Array.from({ length: 14 }, (_, i) =>
        `<rect x="${n(i * 88)}" y="0" width="44" height="${H}" fill="#000000" opacity="0.07"/>`,
      ).join(""),
      `<rect width="${W}" height="${H}" fill="#3a3020" opacity="0.3"/>`,
      `<rect x="76" y="96" width="212" height="392" rx="6" fill="#f3d69c" opacity="0.85"/>`,
      `<rect x="76" y="96" width="212" height="392" rx="6" fill="#ffffff" opacity="0.25" filter="url(#blur16)"/>`,
      `<path d="M 288 120 L 700 210 L 700 ${H} L 200 ${H} Z" fill="#f0c98a" opacity="0.16" filter="url(#blur34)"/>`,
      `<path d="M 0 486 L ${W} 524 L ${W} ${H} L 0 ${H} Z" fill="#8a7550"/>`,
      `<path d="M 0 486 L ${W} 524 L ${W} 556 L 0 518 Z" fill="#6d5b3d" opacity="0.5"/>`,
      trays({ x: 392, y: 688, s: 0.95, levels: 4 }),
      trays({ x: 866, y: 736, s: 1.06, levels: 3 }),
      `<rect width="${W}" height="${H}" fill="#2b2416" opacity="0.08"/>`,
    ].join("\n"),
  );
}

/** 10 — shade trees, cut back before the monsoon. */
function shadeTrees() {
  const L = LIGHT.day;
  return svg(
    L,
    [
      ridge(L, { base: 400, amp: 30, seed: 37, distance: 0.8 }),
      // Tall trunks with high, thinned canopies — sky visible between them,
      // which is the point of regulating shade.
      tree({ x: 200, y: 640, s: 1.35, L, distance: 0.2, seed: 80 }),
      tree({ x: 600, y: 664, s: 1.55, L, distance: 0.1, seed: 82 }),
      tree({ x: 1010, y: 648, s: 1.4, L, distance: 0.18, seed: 84 }),
      floor(486),
      row({ L, y: 566, count: 6, s: 0.56, distance: 0.28, seed: 39 }),
      row({ L, y: 690, count: 5, s: 0.86, distance: 0.08, seed: 41 }),
      // Cut light falling between the trunks.
      `<path d="M 300 300 L 470 300 L 620 ${H} L 380 ${H} Z" fill="#f4f0d8" opacity="0.14" filter="url(#blur34)"/>`,
      `<path d="M 720 320 L 860 320 L 980 ${H} L 790 ${H} Z" fill="#f4f0d8" opacity="0.1" filter="url(#blur34)"/>`,
    ].join("\n"),
  );
}

/** 11 — a stand of cardamom in deep shade, dappled light. */
function standInShade() {
  const L = LIGHT.shade;
  const r = rng(303);
  const dapple = Array.from({ length: 26 }, () => {
    const dx = 600 + (r() - 0.5) * 1000;
    const dy = 520 + (r() - 0.5) * 380;
    const rr = 30 + r() * 70;
    return `<ellipse cx="${n(dx)}" cy="${n(dy)}" rx="${n(rr)}" ry="${n(rr * 0.6)}" fill="#eef4dc" opacity="${n(0.08 + r() * 0.14)}" filter="url(#blur16)"/>`;
  }).join("");

  return svg(
    L,
    [
      `<rect width="${W}" height="${H}" fill="${mix(L.leaf[0], L.haze, 0.5)}"/>`,
      `<rect width="${W}" height="360" fill="${mix(L.leaf[0], "#1f3311", 0.35)}" opacity="0.55" filter="url(#blur34)"/>`,
      Array.from({ length: 6 }, (_, i) =>
        tree({ x: 40 + i * 240, y: 470, s: 0.72, L, distance: 0.42, seed: 90 + i }),
      ).join(""),
      floor(492),
      row({ L, y: 576, count: 6, s: 0.6, distance: 0.28, seed: 44 }),
      row({ L, y: 676, count: 5, s: 0.86, distance: 0.1, seed: 46 }),
      clump({ x: 452, y: 762, s: 1.2, L, distance: 0, seed: 131, lean: -6 }),
      clump({ x: 812, y: 770, s: 1.24, L, distance: 0, seed: 133, lean: 8 }),
      dapple,
    ].join("\n"),
  );
}

/** 12 — a sprinkler line running in a dry spell. */
function sprinkler() {
  const L = LIGHT.day;
  const jets = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 10) * Math.PI;
    const reach = 300;
    const ex = 600 + Math.cos(a) * reach;
    const ey = 604 - Math.sin(a) * 60 + 130;
    jets.push(
      `<path d="M 600 570 Q ${n(600 + Math.cos(a) * reach * 0.55)} ${n(560 - Math.sin(a) * 190)} ${n(ex)} ${n(ey)}" fill="none" stroke="#eaf3e6" stroke-width="5" opacity="0.55" stroke-linecap="round"/>`,
    );
  }
  const dropletR = rng(404);
  const droplets = Array.from({ length: 120 }, () => {
    const dx = 600 + (dropletR() - 0.5) * 660;
    const dy = 560 + dropletR() * 200;
    return `<circle cx="${n(dx)}" cy="${n(dy)}" r="${n(1.6 + dropletR() * 3)}" fill="#f2f8ef" opacity="${n(0.3 + dropletR() * 0.45)}"/>`;
  }).join("");

  return svg(
    L,
    [
      ridge(L, { base: 366, amp: 30, seed: 47, distance: 0.76 }),
      Array.from({ length: 5 }, (_, i) =>
        tree({ x: 100 + i * 260, y: 430, s: 0.52, L, distance: 0.5, seed: 100 + i }),
      ).join(""),
      floor(454),
      row({ L, y: 546, count: 6, s: 0.56, distance: 0.3, seed: 48 }),
      row({ L, y: 662, count: 5, s: 0.8, distance: 0.12, seed: 49 }),
      // Riser pipe and head.
      `<g transform="translate(600 700)">
        <ellipse cx="0" cy="8" rx="52" ry="12" fill="${L.shadow}" opacity="0.24" filter="url(#blur16)"/>
        <rect x="-8" y="-140" width="16" height="140" rx="6" fill="#5c6f78"/>
        <circle cx="0" cy="-146" r="16" fill="#48606b"/>
        <rect x="-26" y="-2" width="52" height="10" rx="5" fill="#48606b"/>
      </g>`,
      jets.join(""),
      droplets,
      `<ellipse cx="600" cy="740" rx="330" ry="48" fill="#6f8f6a" opacity="0.3" filter="url(#blur34)"/>`,
      clump({ x: 224, y: 744, s: 1.05, L, distance: 0.02, seed: 141, lean: -8 }),
      clump({ x: 986, y: 752, s: 1.08, L, distance: 0.02, seed: 143, lean: 9 }),
    ].join("\n"),
  );
}

/** The video poster: a path through the estate, framed like a walkthrough. */
function videoPoster() {
  const L = LIGHT.dawn;
  return svg(
    L,
    [
      ridge(L, { base: 352, amp: 40, seed: 53, distance: 0.78 }),
      mistBand(L, 330, 80, 0.6),
      Array.from({ length: 6 }, (_, i) =>
        tree({ x: 60 + i * 230, y: 448, s: 0.6, L, distance: 0.46, seed: 110 + i }),
      ).join(""),
      floor(468),
      // A track receding to the horizon, which is what a walkthrough looks like.
      `<path d="M 520 468 L 680 468 L 900 ${H} L 300 ${H} Z" fill="#c2ab7e" opacity="0.75"/>`,
      `<path d="M 556 468 L 644 468 L 700 ${H} L 500 ${H} Z" fill="#a89268" opacity="0.35"/>`,
      row({ L, y: 540, count: 7, s: 0.5, distance: 0.34, seed: 54 }),
      clump({ x: 180, y: 660, s: 0.95, L, distance: 0.12, seed: 151, lean: -12 }),
      clump({ x: 1030, y: 672, s: 1, L, distance: 0.12, seed: 153, lean: 13 }),
      clump({ x: 130, y: 782, s: 1.25, L, distance: 0, seed: 155, lean: -16 }),
      clump({ x: 1080, y: 792, s: 1.3, L, distance: 0, seed: 157, lean: 17 }),
      // A touch of extra falloff, so UI chrome sits legibly on top.
      `<rect width="${W}" height="${H}" fill="#2b3a1c" opacity="0.12"/>`,
    ].join("\n"),
  );
}

/* -------------------------------------------------------------------------- */

const FILES = [
  ["public/uploads/estate-1.svg", estateBlock],
  ["public/uploads/estate-2.svg", fertilizerRound],
  ["public/uploads/estate-3.svg", panicles],
  ["public/uploads/estate-4.svg", harvest],
  ["public/uploads/estate-5.svg", freshCapsules],
  ["public/uploads/estate-6.svg", curingHouse],
  ["public/uploads/estate-7.svg", weeding],
  ["public/uploads/estate-8.svg", spraying],
  ["public/uploads/estate-9.svg", dryingTrays],
  ["public/uploads/estate-10.svg", shadeTrees],
  ["public/uploads/estate-11.svg", standInShade],
  ["public/uploads/estate-12.svg", sprinkler],
  ["public/uploads/estate-video-poster.svg", videoPoster],
];

for (const [path, make] of FILES) {
  const contents = make();
  await writeFile(path, contents, "utf8");
  console.log(`${path.padEnd(42)} ${(contents.length / 1024).toFixed(1)} KB`);
}
