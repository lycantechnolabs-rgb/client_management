/**
 * Background textures.
 *
 * The page had one flat cream fill behind everything. A flat fill has no light
 * in it — nothing recedes, nothing comes forward — so a long page reads as a
 * document rather than as a place, and the white cards sat on it like holes.
 *
 * globals.css lays a soft gradient field over the cream; these two tiles give
 * that field something to catch on. Both are deliberately near-invisible on
 * their own: they are felt at 3–6% opacity, not seen.
 *
 * They live in public/ (not public/uploads, which next.config.ts sandboxes for
 * user-supplied bytes) and are referenced from CSS as background images, so
 * they cache once and are shared by every section that uses them.
 *
 * Run: node scripts/draw-textures.mjs
 */
import { writeFile } from "node:fs/promises";

const f = (v) => Number(v.toFixed(1));

/* -------------------------------------------------------------------------- */
/* Hill contours                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Survey contours. Idukki is hill country and the estates are cut into it, so
 * this is the one texture that is about the business rather than decoration.
 *
 * Amplitude and phase drift line to line — a stack of identical waves reads as
 * corrugation, whereas contours nest and wander. The tile is wide (1200) and
 * the strokes are hairline, so the horizontal seam is not findable at the
 * opacity this is used at.
 */
function contours() {
  const W = 1200;
  const H = 600;
  const lines = [];

  for (let i = 0; i < 11; i++) {
    const y = 10 + i * 60; // 60px spacing wraps cleanly against H
    const amp = 22 + ((i * 13) % 20);
    const phase = i * 0.85;
    const step = 150;

    let d = `M -60 ${f(y + Math.sin(phase) * amp)}`;
    for (let x = step; x <= W + 60; x += step) {
      const t = x / step;
      const cy = y + Math.sin(phase + t * 0.8 - 0.4) * amp;
      const ny = y + Math.sin(phase + t * 0.8) * amp;
      d += ` Q ${f(x - step / 2)} ${f(cy)} ${f(x)} ${f(ny)}`;
    }
    lines.push(`<path d="${d}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <g fill="none" stroke="#2e4a1c" stroke-width="1.1" stroke-linecap="round">
${lines.map((l) => "    " + l).join("\n")}
  </g>
</svg>
`;
}

/* -------------------------------------------------------------------------- */
/* Botanical watermark                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A single oversized cardamom leaf, drawn once and bled off the edge of a
 * section. Used at very low opacity on the wide colour bands, where a gradient
 * alone still looks like a gradient — a recognisable silhouette is what makes
 * the band read as designed rather than as a fill.
 */
function leafMark() {
  const len = 620;
  const wid = 132;
  const bend = 150;

  const blade = [
    "M 0 0",
    `C ${f(len * 0.3)} ${f(-wid)} ${f(len * 0.72)} ${f(bend * 0.45 - wid * 0.82)} ${len} ${bend}`,
    `C ${f(len * 0.72)} ${f(bend * 0.45 + wid * 0.82)} ${f(len * 0.3)} ${wid} 0 0`,
    "Z",
  ].join(" ");

  const rib = `M ${f(len * 0.05)} 0 Q ${f(len * 0.6)} ${f(bend * 0.32)} ${f(len * 0.95)} ${f(bend * 0.9)}`;

  // Side veins, angled off the midrib the way they run on a real blade.
  const veins = [];
  for (let i = 1; i <= 9; i++) {
    const t = i / 10;
    const bx = len * t;
    const by = bend * t * t * 0.9;
    const spread = wid * (1 - Math.abs(t - 0.45) * 1.1);
    veins.push(
      `<path d="M ${f(bx)} ${f(by)} q ${f(len * 0.06)} ${f(-spread * 0.5)} ${f(len * 0.1)} ${f(-spread * 0.72)}"/>`,
      `<path d="M ${f(bx)} ${f(by)} q ${f(len * 0.06)} ${f(spread * 0.5)} ${f(len * 0.1)} ${f(spread * 0.72)}"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="360" viewBox="-20 -170 700 360">
  <g fill="none" stroke="#2e4a1c" stroke-width="2.4" stroke-linecap="round">
    <path d="${blade}"/>
    <path d="${rib}" stroke-width="3"/>
    <g stroke-width="1.4" opacity="0.75">
${veins.map((v) => "      " + v).join("\n")}
    </g>
  </g>
</svg>
`;
}

const FILES = [
  ["public/contours.svg", contours()],
  ["public/leaf-mark.svg", leafMark()],
];

for (const [path, contents] of FILES) {
  await writeFile(path, contents, "utf8");
  console.log(`${path.padEnd(26)} ${(contents.length / 1024).toFixed(1)} KB`);
}
