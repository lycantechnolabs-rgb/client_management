/**
 * Generates on-brand SVG placeholders into /public/uploads so the demo has
 * imagery with zero external requests. Replace these with real estate and
 * product photography before showing the site publicly.
 *
 *   node scripts/make-placeholders.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "uploads");
mkdirSync(OUT, { recursive: true });

const palettes = [
  ["#dfe8cf", "#a8c08a", "#3a5f24"],
  ["#e6ecd8", "#94b377", "#2e4a1c"],
  ["#d6e3c4", "#7ba05b", "#26401a"],
  ["#eaf0de", "#b3c79c", "#426b2a"],
  ["#dae6c9", "#88a96b", "#33511f"],
  ["#e3ebd5", "#9cbb80", "#2b4519"],
];

function pod(cx, cy, rx, ry, fill, stroke, rotate = 0) {
  return `<g transform="rotate(${rotate} ${cx} ${cy})">
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
    <path d="M ${cx} ${cy - ry} L ${cx} ${cy + ry}" stroke="${stroke}" stroke-width="1.4" opacity="0.55"/>
    <path d="M ${cx - rx * 0.5} ${cy - ry * 0.7} Q ${cx - rx * 0.62} ${cy} ${cx - rx * 0.5} ${cy + ry * 0.7}" stroke="${stroke}" stroke-width="1.1" fill="none" opacity="0.4"/>
    <path d="M ${cx + rx * 0.5} ${cy - ry * 0.7} Q ${cx + rx * 0.62} ${cy} ${cx + rx * 0.5} ${cy + ry * 0.7}" stroke="${stroke}" stroke-width="1.1" fill="none" opacity="0.4"/>
    <path d="M ${cx - 4} ${cy - ry - 1} q 4 -12 8 0" stroke="#7a5c2e" stroke-width="4" fill="none" stroke-linecap="round"/>
  </g>`;
}

function scene(label, i, w = 1200, h = 800) {
  const [bg, mid, dark] = palettes[i % palettes.length];
  const hills = `
    <path d="M0 ${h * 0.62} Q ${w * 0.22} ${h * 0.44} ${w * 0.46} ${h * 0.6} T ${w} ${h * 0.55} L ${w} ${h} L 0 ${h} Z" fill="${mid}" opacity="0.5"/>
    <path d="M0 ${h * 0.74} Q ${w * 0.3} ${h * 0.58} ${w * 0.58} ${h * 0.73} T ${w} ${h * 0.68} L ${w} ${h} L 0 ${h} Z" fill="${mid}" opacity="0.75"/>`;

  const leaves = Array.from({ length: 7 }, (_, k) => {
    const x = (w / 8) * (k + 1);
    const y = h * 0.82 + (k % 3) * 22;
    const r = -35 + k * 13;
    return `<path d="M ${x} ${y} q 34 -26 66 -6 q -30 28 -66 6 Z" fill="${dark}" opacity="${0.18 + (k % 3) * 0.07}" transform="rotate(${r} ${x} ${y})"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">
  <rect width="${w}" height="${h}" fill="${bg}"/>
  ${hills}
  ${leaves}
  ${pod(w * 0.5, h * 0.42, 78, 118, bg, dark, -6)}
  ${pod(w * 0.34, h * 0.5, 52, 80, mid, dark, 12)}
  ${pod(w * 0.66, h * 0.5, 52, 80, mid, dark, -14)}
  <text x="${w / 2}" y="${h - 38}" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="${dark}" opacity="0.72">${label}</text>
</svg>`;
}

function documentCard(label) {
  const w = 800;
  const h = 1040;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">
  <rect width="${w}" height="${h}" fill="#f6f3e9"/>
  <rect x="60" y="60" width="${w - 120}" height="${h - 120}" rx="10" fill="#ffffff" stroke="#e2dfd2" stroke-width="2"/>
  <rect x="110" y="130" width="300" height="26" rx="6" fill="#2e4a1c" opacity="0.85"/>
  <rect x="110" y="184" width="200" height="16" rx="5" fill="#6b6b60" opacity="0.5"/>
  ${Array.from({ length: 15 }, (_, i) => `<rect x="110" y="${252 + i * 38}" width="${560 - (i % 4) * 90}" height="12" rx="4" fill="#6b6b60" opacity="0.26"/>`).join("")}
  <rect x="110" y="860" width="220" height="12" rx="4" fill="#4a7c2f" opacity="0.5"/>
  <text x="${w / 2}" y="965" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#2e4a1c" opacity="0.7">${label}</text>
</svg>`;
}

function productShot(label, i) {
  const w = 900;
  const h = 900;
  const [bg, mid, dark] = palettes[i % palettes.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">
  <rect width="${w}" height="${h}" fill="${bg}"/>
  <circle cx="${w / 2}" cy="${h / 2}" r="300" fill="#ffffff" opacity="0.55"/>
  ${pod(w * 0.5, h * 0.46, 96, 146, "#ffffff", dark, -4)}
  ${pod(w * 0.31, h * 0.6, 62, 94, mid, dark, 22)}
  ${pod(w * 0.69, h * 0.6, 62, 94, mid, dark, -22)}
  ${pod(w * 0.42, h * 0.72, 44, 66, bg, dark, 40)}
  ${pod(w * 0.6, h * 0.74, 44, 66, bg, dark, -38)}
  <text x="${w / 2}" y="${h - 54}" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="${dark}" opacity="0.75">${label}</text>
</svg>`;
}

/**
 * Hero backdrop: soft cream-to-green wash with an out-of-focus leaf top right
 * and a blurred pile of pods bottom right, mimicking the depth of field in the
 * approved mockup. Replace with real photography when it is shot.
 */
function heroBackground() {
  const w = 1600;
  const h = 900;

  const pile = Array.from({ length: 26 }, (_, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = w * 0.66 + col * 52 + (row % 2) * 26 + (i % 3) * 8;
    const y = h * 0.7 + row * 44 + (col % 3) * 10;
    const r = -30 + ((i * 37) % 70);
    const shade = ["#b9cf9c", "#a6c088", "#c7daad", "#93b177"][i % 4];
    return `<g transform="rotate(${r} ${x} ${y})">
      <ellipse cx="${x}" cy="${y}" rx="26" ry="38" fill="${shade}"/>
      <path d="M ${x} ${y - 38} L ${x} ${y + 38}" stroke="#7d9a63" stroke-width="1.6" opacity="0.5"/>
      <path d="M ${x - 3} ${y - 39} q 3 -9 6 0" stroke="#8a6a38" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    </g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="0.4">
      <stop offset="0%" stop-color="#f7f4ea"/>
      <stop offset="52%" stop-color="#f1f0e0"/>
      <stop offset="100%" stop-color="#dfead0"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.72" cy="0.42" r="0.6">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16"/>
    </filter>
    <filter id="softer" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="30"/>
    </filter>
    <filter id="pileBlur" x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur stdDeviation="7"/>
    </filter>
  </defs>

  <rect width="${w}" height="${h}" fill="url(#wash)"/>

  <!-- out-of-focus foliage, top right -->
  <g filter="url(#softer)" opacity="0.75">
    <path d="M ${w * 0.78} -60 q 210 130 150 330 q -150 -70 -230 -190 Z" fill="#5f8a3f"/>
    <path d="M ${w * 0.94} 40 q 150 190 40 350 q -120 -110 -130 -260 Z" fill="#4e7733"/>
  </g>
  <g filter="url(#soft)" opacity="0.55">
    <path d="M ${w * 0.7} 10 q 150 90 120 250 q -130 -60 -180 -170 Z" fill="#6f9a4b"/>
  </g>

  <ellipse cx="${w * 0.72}" cy="${h * 0.44}" rx="${w * 0.42}" ry="${h * 0.5}" fill="url(#glow)"/>

  <!-- pile of pods, bottom right, softly out of focus -->
  <g filter="url(#pileBlur)" opacity="0.9">${pile}</g>

  <!-- ground haze so the mascot reads as standing on something -->
  <ellipse cx="${w * 0.55}" cy="${h * 0.93}" rx="${w * 0.36}" ry="60" fill="#cfdfb8" opacity="0.5" filter="url(#soft)"/>
</svg>`;
}

writeFileSync(join(OUT, "..", "hero-bg.svg"), heroBackground());

const estateLabels = [
  "Estate block",
  "Fertilizer round",
  "Panicle inspection",
  "Harvest — picking",
  "Fresh capsules",
  "Curing house",
  "After weeding",
  "Spray round",
  "Drying trays",
  "Shade trees",
  "Organic application",
  "Sprinkler line",
];

estateLabels.forEach((label, i) => {
  writeFileSync(join(OUT, `estate-${i + 1}.svg`), scene(label, i));
});

["Residue test report", "Nursery invoice", "Spice Board registration"].forEach(
  (label, i) => {
    writeFileSync(join(OUT, `document-${i + 1}.svg`), documentCard(label));
  },
);

[
  "Alleppey Green Extra Bold",
  "Extra Bold — capsules",
  "Alleppey Green Bold",
  "Cardamom seeds",
  "Ground cardamom",
].forEach((label, i) => {
  writeFileSync(join(OUT, `product-${i + 1}.svg`), productShot(label, i + 2));
});

writeFileSync(
  join(OUT, "estate-video-poster.svg"),
  scene("Estate walkthrough", 3),
);

console.log(`Wrote placeholders to ${OUT}`);
