/**
 * Document previews for the attachments filed against activities.
 *
 * The originals were the same wireframe three times: a white rectangle, a stack
 * of grey bars of decreasing width, and the document's name set in serif at the
 * bottom of the artwork. Unlike the product and estate images these are never
 * shown as thumbnails — the documents list renders a generic file icon and the
 * URL opens standalone — so what a grower actually sees when they tap a lab
 * report is a full page of grey bars.
 *
 * These are laid out as real documents instead: letterhead, reference block,
 * ruled tables, totals, a signature area. The content matches the activity the
 * document is filed against, so the residue report tests for the fungicides
 * that spray actually used and the invoice bills the suckers that planting
 * actually recorded.
 *
 * SPECIMEN. Two of these stand in for official records — a laboratory result
 * and a registration certificate. They are drawn with a diagonal SPECIMEN
 * watermark, placeholder reference numbers, an unsigned signature block and no
 * authority emblem of any kind. They are meant to look right in a demo, not to
 * be capable of passing as a genuine certificate.
 *
 * Run: node scripts/draw-documents.mjs
 */
import { writeFile } from "node:fs/promises";

const W = 800;
const H = 1040;
const M = 74; // page margin
const RIGHT = W - M;

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const INK = "#1f2a16";
const BODY = "#4a4a42";
const MUTED = "#7a7a6e";
const RULE = "#ddd9c9";
const FOREST = "#2e4a1c";
const CLAY = "#a9521f";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const text = (x, y, s, o = {}) =>
  `<text x="${x}" y="${y}" font-family="${o.font ?? SANS}" font-size="${o.size ?? 12}" fill="${o.fill ?? BODY}"${o.weight ? ` font-weight="${o.weight}"` : ""}${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.spacing ? ` letter-spacing="${o.spacing}"` : ""}${o.opacity ? ` opacity="${o.opacity}"` : ""}>${esc(s)}</text>`;

const rule = (y, x0 = M, x1 = RIGHT, colour = RULE, width = 1) =>
  `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${colour}" stroke-width="${width}"/>`;

/** Small caps label above a value. */
const field = (x, y, label, value, o = {}) =>
  [
    text(x, y, label.toUpperCase(), {
      size: 8.5,
      fill: MUTED,
      spacing: 1.2,
      weight: "600",
    }),
    text(x, y + 19, value, {
      size: 12.5,
      fill: INK,
      font: o.font ?? SANS,
      weight: o.weight,
    }),
  ].join("");

/* -------------------------------------------------------------------------- */
/* Page furniture                                                              */
/* -------------------------------------------------------------------------- */

function defs() {
  return `<defs>
    <filter id="sheet" x="-10%" y="-6%" width="120%" height="112%">
      <feDropShadow dx="0" dy="6" stdDeviation="14" flood-color="#2e4a1c" flood-opacity="0.13"/>
    </filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>`;
}

/** The AELA letterhead, shared by all three. */
function letterhead(kind, ref) {
  return `
  <g>
    <circle cx="${M + 17}" cy="86" r="17" fill="${FOREST}"/>
    ${text(M + 17, 92, "A", { font: SERIF, size: 18, fill: "#f6f3e9", anchor: "middle" })}
    ${text(M + 44, 84, "AELA", { font: SERIF, size: 19, fill: FOREST, spacing: 1.6 })}
    ${text(M + 44, 101, "Cardamom estate management · Idukki, Kerala", { size: 9.5, fill: MUTED })}
    ${text(RIGHT, 80, kind.toUpperCase(), { size: 9, fill: MUTED, anchor: "end", spacing: 1.4, weight: "600" })}
    ${text(RIGHT, 100, ref, { size: 11, fill: INK, anchor: "end" })}
  </g>
  ${rule(124)}`;
}

/**
 * Diagonal SPECIMEN mark. Deliberately unmissable: these documents stand in for
 * a lab result and a registration, and neither should be mistakable for the
 * real thing if the file escapes the demo.
 */
function specimen() {
  // Sized to sit inside the sheet once rotated: letter-spacing is added after
  // the anchor is resolved, so a wide tracked string drifts left of centre
  // unless the spacing is kept small.
  return `<g transform="translate(${W / 2} ${H / 2}) rotate(-32)" opacity="0.085">
    ${text(0, 0, "SPECIMEN", { font: SERIF, size: 82, fill: FOREST, anchor: "middle", spacing: 3, weight: "700" })}
    ${text(0, 44, "not a valid document", { size: 19, fill: FOREST, anchor: "middle", spacing: 2 })}
  </g>`;
}

function footer(note) {
  return `${rule(H - 96)}
  ${text(M, H - 74, note, { size: 9, fill: MUTED })}
  ${text(RIGHT, H - 74, "Sample document — generated for demonstration", { size: 9, fill: MUTED, anchor: "end" })}`;
}

/** A ruled table. `cols` are [label, x, anchor]. */
function table(y, cols, rows, o = {}) {
  const out = [];
  const rowH = o.rowH ?? 30;

  out.push(`<rect x="${M}" y="${y - 20}" width="${RIGHT - M}" height="28" fill="${FOREST}" opacity="0.06"/>`);
  for (const [label, x, anchor] of cols) {
    out.push(
      text(x, y, label.toUpperCase(), {
        size: 8.5,
        fill: FOREST,
        spacing: 1,
        weight: "600",
        anchor,
      }),
    );
  }

  rows.forEach((row, i) => {
    const ry = y + 8 + rowH * (i + 1);
    out.push(rule(ry - rowH + 12, M, RIGHT, "#ece8db"));
    row.forEach((cell, c) => {
      const [, x, anchor] = cols[c];
      const strong = o.strongCols?.includes(c);
      out.push(
        text(x, ry, cell, {
          size: 11.5,
          fill: strong ? INK : BODY,
          anchor,
          weight: strong ? "600" : undefined,
        }),
      );
    });
  });

  return { svg: out.join("\n"), endY: y + 8 + rowH * (rows.length + 1) - 18 };
}

const page = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Specimen document">
${defs()}
<rect width="${W}" height="${H}" fill="#eae6d8"/>
<rect x="26" y="20" width="${W - 52}" height="${H - 40}" rx="3" fill="#ffffff" filter="url(#sheet)"/>
${specimen()}
${body}
<rect x="26" y="20" width="${W - 52}" height="${H - 40}" rx="3" fill="none" stroke="${RULE}" stroke-width="1"/>
<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.035"/>
</svg>
`;

/* -------------------------------------------------------------------------- */
/* 1 — residue test report                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Filed against the preventive Bordeaux + Bavistin spray, so the analytes are
 * the ones that spray actually used: copper, carbendazim, plus the two most
 * commonly screened for on cardamom.
 */
function residueReport() {
  const results = table(
    440,
    [
      ["Analyte", M, "start"],
      ["Method", 330, "start"],
      ["MRL (mg/kg)", 560, "end"],
      ["Result", RIGHT, "end"],
    ],
    [
      ["Carbendazim", "LC-MS/MS", "0.10", "< 0.01"],
      ["Copper (as Cu)", "AAS", "40.0", "6.8"],
      ["Chlorpyrifos", "GC-MS/MS", "0.05", "Not detected"],
      ["Quinalphos", "GC-MS/MS", "0.01", "Not detected"],
      ["Total ash", "Gravimetric", "9.0", "5.4"],
    ],
    { strongCols: [0, 3] },
  );

  return page(
    [
      letterhead("Laboratory report", "Ref. LAB/SPEC/0000"),
      text(M, 176, "Pesticide residue analysis", {
        font: SERIF,
        size: 27,
        fill: FOREST,
      }),
      text(M, 200, "Green cardamom (Elettaria cardamomum) — whole capsules", {
        size: 11.5,
        fill: MUTED,
      }),

      field(M, 248, "Sample reference", "SPECIMEN — no sample"),
      field(330, 248, "Grade", "Alleppey Green Extra Bold"),
      field(560, 248, "Date received", "18 June"),

      field(M, 316, "Estate", "Cheruvally block"),
      field(330, 316, "Drawn by", "Estate supervisor"),
      field(560, 316, "Quantity", "500 g"),

      rule(370),
      text(M, 404, "Results", {
        font: SERIF,
        size: 15,
        fill: FOREST,
      }),
      results.svg,

      `<rect x="${M}" y="${results.endY + 26}" width="${RIGHT - M}" height="74" rx="4" fill="${FOREST}" opacity="0.05"/>`,
      text(M + 20, results.endY + 54, "Conclusion", {
        size: 9,
        fill: MUTED,
        spacing: 1.2,
        weight: "600",
      }),
      text(
        M + 20,
        results.endY + 76,
        "All analytes within the limits applied for this specimen report.",
        { size: 12, fill: INK },
      ),

      text(M, results.endY + 168, "Analysed by", { size: 9, fill: MUTED, spacing: 1.2, weight: "600" }),
      rule(results.endY + 196, M, M + 220, "#c9c4b2"),
      text(M, results.endY + 214, "Signature not present on a specimen", {
        size: 9.5,
        fill: MUTED,
      }),

      text(RIGHT, results.endY + 168, "Report date", {
        size: 9,
        fill: MUTED,
        spacing: 1.2,
        weight: "600",
        anchor: "end",
      }),
      text(RIGHT, results.endY + 196, "22 June", { size: 12, fill: INK, anchor: "end" }),

      footer("Residue-test-report-June.pdf"),
    ].join("\n"),
  );
}

/* -------------------------------------------------------------------------- */
/* 2 — nursery invoice                                                         */
/* -------------------------------------------------------------------------- */

/** Bills exactly what the gap-filling activity recorded: 180 suckers, ₹9,000. */
function nurseryInvoice() {
  const items = table(
    436,
    [
      ["Description", M, "start"],
      ["Qty", 470, "end"],
      ["Rate", 570, "end"],
      ["Amount", RIGHT, "end"],
    ],
    [
      ["Njallani cardamom suckers", "180 nos", "₹50.00", "₹9,000"],
      ["Packing and transport", "1", "₹0.00", "Included"],
    ],
    { strongCols: [0, 3] },
  );

  const totalsY = items.endY + 34;
  const totals = [
    ["Subtotal", "₹9,000"],
    ["GST (nil — nursery stock)", "₹0"],
  ]
    .map(([k, v], i) =>
      [
        text(470, totalsY + i * 26, k, { size: 11.5, fill: BODY, anchor: "end" }),
        text(RIGHT, totalsY + i * 26, v, { size: 11.5, fill: INK, anchor: "end" }),
      ].join(""),
    )
    .join("");

  return page(
    [
      letterhead("Purchase invoice", "Invoice SPEC/0000"),
      text(M, 176, "Tax invoice", { font: SERIF, size: 27, fill: FOREST }),
      text(M, 200, "Planting material — gap filling", { size: 11.5, fill: MUTED }),

      field(M, 248, "Supplier", "Nursery (specimen)"),
      field(330, 248, "Invoice date", "12 September"),
      field(560, 248, "Terms", "On delivery"),

      field(M, 316, "Billed to", "AELA — Cheruvally block"),
      field(330, 316, "GSTIN", "Not shown on specimen"),

      rule(366),
      text(M, 400, "Items", { font: SERIF, size: 15, fill: FOREST }),
      items.svg,

      rule(totalsY - 24, 380, RIGHT),
      totals,
      rule(totalsY + 40, 380, RIGHT, "#c9c4b2", 1.5),
      text(470, totalsY + 68, "Total", {
        size: 13,
        fill: INK,
        anchor: "end",
        weight: "600",
      }),
      text(RIGHT, totalsY + 68, "₹9,000", {
        font: SERIF,
        size: 20,
        fill: CLAY,
        anchor: "end",
      }),

      text(M, totalsY + 148, "Received in good condition", {
        size: 9,
        fill: MUTED,
        spacing: 1.2,
        weight: "600",
      }),
      rule(totalsY + 176, M, M + 220, "#c9c4b2"),
      text(M, totalsY + 194, "Signature not present on a specimen", {
        size: 9.5,
        fill: MUTED,
      }),

      footer("Nursery-invoice-suckers.pdf"),
    ].join("\n"),
  );
}

/* -------------------------------------------------------------------------- */
/* 3 — registration certificate                                                */
/* -------------------------------------------------------------------------- */

/**
 * Stands in for the Spice Board registration copy. Deliberately generic: no
 * emblem, no authority name set as a heading, every identifier zeroed, and the
 * validity block says specimen. A grower should recognise what it represents
 * without the file being usable as anything.
 */
function registration() {
  return page(
    [
      letterhead("Registration copy", "Reg. no. XXXX/XXXX/0000"),
      text(W / 2, 214, "Certificate of Registration", {
        font: SERIF,
        size: 30,
        fill: FOREST,
        anchor: "middle",
      }),
      text(W / 2, 242, "SPECIMEN COPY — ISSUED BY NO AUTHORITY", {
        size: 10,
        fill: CLAY,
        anchor: "middle",
        spacing: 2,
        weight: "600",
      }),
      rule(276, M + 120, RIGHT - 120, "#c9c4b2"),

      text(W / 2, 322, "This specimen records that the holder named below is", {
        size: 12,
        fill: BODY,
        anchor: "middle",
      }),
      text(W / 2, 344, "registered as a dealer in cardamom.", {
        size: 12,
        fill: BODY,
        anchor: "middle",
      }),

      `<rect x="${M}" y="392" width="${RIGHT - M}" height="196" rx="5" fill="${FOREST}" opacity="0.04"/>`,
      field(M + 28, 432, "Registered holder", "AELA"),
      field(M + 28, 500, "Address", "Vandanmedu, Idukki, Kerala"),
      field(430, 432, "Category", "Dealer — spices"),
      field(430, 500, "Registration no.", "XXXX/XXXX/0000"),

      field(M, 654, "Valid from", "— specimen —"),
      field(330, 654, "Valid to", "— specimen —"),
      field(560, 654, "Issued at", "— specimen —"),

      rule(716),
      text(
        M,
        750,
        "This document is a sample rendered for a demonstration system.",
        { size: 11, fill: MUTED },
      ),
      text(M, 772, "It carries no seal, no signature and no legal effect.", {
        size: 11,
        fill: MUTED,
      }),

      text(RIGHT, 830, "For the registering authority", {
        size: 9,
        fill: MUTED,
        anchor: "end",
        spacing: 1.2,
        weight: "600",
      }),
      rule(866, RIGHT - 220, RIGHT, "#c9c4b2"),
      text(RIGHT, 884, "Unsigned specimen", {
        size: 9.5,
        fill: MUTED,
        anchor: "end",
      }),

      footer("Spice-Board-registration.pdf"),
    ].join("\n"),
  );
}

/* -------------------------------------------------------------------------- */

const FILES = [
  ["public/uploads/document-1.svg", residueReport],
  ["public/uploads/document-2.svg", nurseryInvoice],
  ["public/uploads/document-3.svg", registration],
];

for (const [path, make] of FILES) {
  const contents = make();
  await writeFile(path, contents, "utf8");
  console.log(`${path.padEnd(38)} ${(contents.length / 1024).toFixed(1)} KB`);
}
