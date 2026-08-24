/**
 * Imports the supplied cardamom photography into the site.
 *
 * The sources are 1536x1024 PNGs of 1.3–2.6 MB each — fine as masters, far too
 * heavy to serve. Each one is cropped to the aspect ratio of the slot it fills
 * (a 5:4 store card, a 16:9 hero) rather than being squashed by object-cover at
 * runtime, then written as WebP at a size that suits how large it is actually
 * drawn. That turns ~13 MB of PNG into a few hundred KB.
 *
 * WHERE THEY GO, and why not everywhere:
 *
 *   Photographs are used for the two whole-pod products and for the page heroes
 *   — the places where showing the actual goods and the actual hillside is what
 *   earns trust. The nine-scene gallery stays illustrated. Two photographs
 *   dropped into a coherent set of nine drawings does not read as "some photos
 *   yet to come", it reads as a mistake; and there are no photographs for the
 *   decorticated seed or the ground powder, so those product cards would be
 *   mismatched too.
 *
 * Run: node scripts/import-photos.mjs
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const SRC = "C:/Users/aswin/Downloads";
const OUT = "public/photos";

const s = (name) => path.join(SRC, `ChatGPT Image Aug 24, 2026, ${name} PM.png`);

/**
 * gravity picks which part survives the crop. The plantation shot is composed
 * down the row, so it keeps its centre; the pod-on-white shots sit low in frame
 * and lose their empty sky if cropped centrally.
 */
const JOBS = [
  {
    src: s("02_47_11"),
    out: "estate-rows.webp",
    width: 2000,
    height: 1125, // 16:9 — homepage hero and about hero
    gravity: "centre",
    note: "plantation rows, low angle",
  },
  {
    src: s("02_36_38"),
    out: "harvest-bowl.webp",
    width: 1600,
    height: 900,
    gravity: "centre",
    note: "bowl and panicle on wood",
  },
  {
    src: s("02_51_27"),
    out: "pods-group.webp",
    width: 1200,
    height: 960, // 5:4 — store card
    gravity: "centre",
    note: "five whole pods on white",
  },
  {
    src: s("02_50_23"),
    out: "pod-single.webp",
    width: 1200,
    height: 960,
    gravity: "centre",
    note: "single pod on white, detail",
  },
  {
    src: s("02_44_51"),
    out: "pods-bowl.webp",
    width: 1200,
    height: 960,
    gravity: "centre",
    note: "bowl with leaf",
  },
  {
    src: s("02_42_20"),
    out: "hero-pods.webp",
    width: 2000,
    height: 1125, // 16:9 — homepage hero
    // The pile sits right and the ground on the left is deliberately empty.
    // That empty half is where the headline goes, so the crop keeps it.
    gravity: "east",
    note: "pile with leaf — homepage hero",
  },
  {
    src: s("02_42_20"),
    out: "pods-leaf.webp",
    width: 1600,
    height: 900,
    gravity: "east", // the pile sits right; the left is deliberate copy space
    note: "pile with leaf, copy space left",
  },
];

await mkdir(OUT, { recursive: true });

let totalIn = 0;
let totalOut = 0;

for (const job of JOBS) {
  if (!existsSync(job.src)) {
    console.warn(`  ! missing source, skipped: ${path.basename(job.src)}`);
    continue;
  }

  const dest = path.join(OUT, job.out);
  const info = await sharp(job.src)
    .resize(job.width, job.height, { fit: "cover", position: job.gravity })
    .webp({ quality: 76, effort: 6 })
    .toFile(dest);

  // metadata().size is not populated when the input is a path, only a buffer.
  const inBytes = statSync(job.src).size;
  totalIn += inBytes;
  totalOut += info.size;

  console.log(
    `${job.out.padEnd(20)} ${job.width}x${job.height}  ` +
      `${(inBytes / 1024 / 1024).toFixed(1)}MB -> ${(info.size / 1024).toFixed(0)}KB   ${job.note}`,
  );
}

console.log(
  `\ntotal ${(totalIn / 1024 / 1024).toFixed(1)}MB -> ${(totalOut / 1024).toFixed(0)}KB`,
);
