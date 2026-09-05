/**
 * Does the seed clear every table it is about to rebuild?
 *
 * It missed four for a while — Enquiry, Notification, UploadTicket and
 * ClientPermission — and the symptom was indirect: a re-run died partway on a
 * unique `reference` and left the database half-built, with no error saying
 * which table was at fault. The cause was simply that the clearing block was
 * never updated when those models were added.
 *
 * That will happen again the next time someone adds a model, so it is checked
 * rather than remembered.
 *
 *   npm run check:seed
 */
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const seed = readFileSync("prisma/seed.ts", "utf8");

const models = [...schema.matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]);
const cleared = new Set(
  [...seed.matchAll(/db\.(\w+)\.deleteMany\(\)/g)].map((m) => m[1]),
);

// Prisma's client property is the model name with a lowercase first letter.
const property = (model) => model[0].toLowerCase() + model.slice(1);
const missing = models.filter((m) => !cleared.has(property(m)));

console.log(`\nSeed clears ${cleared.size} of ${models.length} models.\n`);

if (missing.length > 0) {
  console.error("  Not cleared by prisma/seed.ts:\n");
  for (const m of missing) console.error(`    ${m}`);
  console.error(
    "\n  Add `await db.<model>.deleteMany();` to the clearing block in\n" +
      "  prisma/seed.ts — leaf tables before the rows they point at.\n" +
      "  Left out, a re-run fails partway and leaves the database half-built.\n",
  );
  process.exitCode = 1;
} else {
  console.log("  Every model is cleared before the rebuild.\n");
}
