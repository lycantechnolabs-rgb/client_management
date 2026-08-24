/**
 * The supplied mascot render was delivered flattened onto white (PNG colour
 * type 2 — no alpha), which put a hard white rectangle in the middle of the
 * hero. This cuts a proper matte.
 *
 * A plain "white pixels are transparent" threshold would also punch holes in
 * the mascot's eyes and highlights, so instead we flood-fill inward from the
 * border: only white that is *connected to the edge* is background. The mask is
 * then eroded a touch and feathered, which removes the white fringe left by the
 * original compositing.
 *
 * Run: node scripts/matte-mascot.mjs <source.png> <out.png>
 *
 * The flattened originals live in design-assets/ (outside public/, so they are
 * not served); the cut versions are public/*-cutout.png. Re-run this if the
 * artwork is ever re-delivered flattened again.
 */
import sharp from "sharp";

/* The render is not on flat white — it sits on a soft grey floor shadow that
   fades out over a couple of hundred pixels. Keying on brightness alone left
   that shadow behind as a pale wedge, so the test is brightness AND neutrality:
   the background and its shadow are grey (all three channels within SPREAD of
   each other), while every part of the mascot is a saturated green, yellow or
   brown even at its lightest. That lets the brightness floor come right down
   without eating into the character. */
const NEAR_WHITE = 186; // channel floor to count as background
const SPREAD = 14; // max channel difference — grey, not tinted

async function matte(original, file) {
  const { data, info } = await sharp(original)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const n = width * height;
  const isWhite = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4],
      g = data[i * 4 + 1],
      b = data[i * 4 + 2];
    const min = Math.min(r, g, b);
    isWhite[i] = min >= NEAR_WHITE && Math.max(r, g, b) - min <= SPREAD ? 1 : 0;
  }

  // Flood fill from every border pixel.
  const bg = new Uint8Array(n);
  const stack = [];
  for (let x = 0; x < width; x++) {
    stack.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    stack.push(y * width, y * width + width - 1);
  }
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || !isWhite[i]) continue;
    bg[i] = 1;
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < width - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - width);
    if (y < height - 1) stack.push(i + width);
  }

  // Foreground mask, blurred to feather, then re-levelled so the soft edge
  // lands just inside the original silhouette rather than outside it.
  const mask = Buffer.alloc(n);
  for (let i = 0; i < n; i++) mask[i] = bg[i] ? 0 : 255;

  // toColourspace("b-w") is load-bearing: blur() and linear() promote a
  // single-channel raw buffer to three channels, and reading that back at a
  // stride of one silently scrambles the mask.
  const feathered = await sharp(mask, {
    raw: { width, height, channels: 1 },
  })
    .blur(1.2)
    .linear(1.9, -150)
    .toColourspace("b-w")
    .raw()
    .toBuffer();

  if (feathered.length !== n) {
    throw new Error(
      `mask came back with ${feathered.length / n} channels, expected 1`,
    );
  }

  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    out[i * 4] = data[i * 4];
    out[i * 4 + 1] = data[i * 4 + 1];
    out[i * 4 + 2] = data[i * 4 + 2];
    out[i * 4 + 3] = feathered[i];
  }

  await sharp(out, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(file);

  let cut = 0;
  for (let i = 0; i < n; i++) if (feathered[i] < 8) cut++;
  console.log(
    `${file}: ${width}x${height}, ${((cut / n) * 100).toFixed(1)}% cut to transparent`,
  );
}

const PAIRS = [
  ["design-assets/mascot.original.png", "public/mascot-cutout.png"],
  [
    "design-assets/mascot-expressions.original.png",
    "public/mascot-expressions-cutout.png",
  ],
];

const [src, out] = process.argv.slice(2);
for (const pair of src && out ? [[src, out]] : PAIRS) {
  await matte(...pair);
}
