/**
 * A real call against a real translation provider.
 *
 * Everything around the provider is proved in the audit: that it stays off
 * without a key, that a cached note costs nothing, that a failure falls back to
 * English. None of that proves a provider will accept the request — nothing
 * does, short of asking one. This asks one.
 *
 *   npm run verify:translate
 *
 * Run it the moment you add a key, and again the first time a grower reports
 * seeing English where Malayalam should be. It is the difference between "the
 * key is wrong" and "the code is wrong", which are very different afternoons.
 *
 * It translates four short phrases. That is a fraction of a paisa, and it is a
 * real charge on a real account — this is not a dry run.
 */
import "./resolve-app-imports.mjs";

// Dynamic, not static: every static import in a file is resolved before any of
// its code runs, so a static import here would be looked up before the hook
// above had a chance to register.
const { provider, translateMany } = await import("@/lib/translate/index");

/*
 * Sentences shaped like the ones Jinto actually writes.
 *
 * Not "hello world": a provider can return something for that and still mangle
 * an estate note. These carry the things that go wrong — a number with a unit,
 * a proper noun, and a bare fragment of the kind that ends up in a caption.
 */
const SAMPLES = [
  "Second round NPK application",
  "Applied around the base of each clump, 20 cm from the plant.",
  "Cheruvally block, after the rain on Tuesday",
  "Picked 40 kg green, dried to 8 kg.",
];

/** Malayalam occupies its own Unicode block, so this is a real check. */
const MALAYALAM = /[ഀ-ൿ]/;

async function main() {
  const p = provider();

  if (!p) {
    const which = process.env.TRANSLATE_PROVIDER ?? "(unset)";
    console.error(
      `\n  Translation is off. TRANSLATE_PROVIDER is ${which}.\n\n` +
        `  Set it to "google" or "azure" in .env, with the matching key:\n` +
        `    TRANSLATE_PROVIDER=google\n` +
        `    GOOGLE_TRANSLATE_KEY=...\n\n` +
        `  or\n\n` +
        `    TRANSLATE_PROVIDER=azure\n` +
        `    AZURE_TRANSLATE_KEY=...\n` +
        `    AZURE_TRANSLATE_REGION=centralindia\n\n` +
        `  Read docs/dpdp/translation.md before you do — turning this on has\n` +
        `  paperwork attached, not just a bill.\n`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\n  Provider: ${p.name}\n`);

  /*
   * Straight at the provider, deliberately bypassing translateMany.
   *
   * translateMany is built to swallow failures and return English, which is
   * right for a grower reading a page and useless for a person trying to find
   * out why. Here the error is the answer, so it is allowed to escape.
   */
  let out: string[];
  const started = Date.now();
  try {
    out = await p.translate(SAMPLES, "ml");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  The call failed: ${message}\n`);
    // 400 is in here on purpose, and it is the one that catches people out:
    // Google's v2 API answers an invalid key with 400, not the 401 you would
    // expect. Measured against the live endpoint with a junk key, which is the
    // one thing about this provider I have been able to test for real.
    if (/40[013]/.test(message)) {
      console.error(
        `  A 400, 401 or 403 is almost always the key rather than the code —\n` +
          `  Google answers an invalid key with 400, not 401. Check that it is\n` +
          `  correct, that the Cloud Translation API is enabled on the project,\n` +
          `  and that the project has billing attached. A key with no billing\n` +
          `  behind it authenticates and then refuses to work.\n`,
      );
    } else if (/429/.test(message)) {
      console.error(
        `  A 429 is a quota, not a fault — the key works and you have used it\n` +
          `  up. On Azure's free F0 tier that is two million characters, and it\n` +
          `  resets at the start of the month rather than billing you for the\n` +
          `  overflow. Growers keep seeing English until it does.\n`,
      );
    }
    if (p.name === "azure" && /401/.test(message)) {
      console.error(
        `  For Azure specifically: a regional resource needs\n` +
          `  AZURE_TRANSLATE_REGION set to its region, and a global one needs it\n` +
          `  left unset. Sending the wrong one is a 401 that says nothing else.\n`,
      );
    }
    process.exitCode = 1;
    return;
  }
  const took = Date.now() - started;

  let bad = 0;
  for (const [i, source] of SAMPLES.entries()) {
    const result = out[i] ?? "";
    const ok = MALAYALAM.test(result) && result !== source;
    if (!ok) bad++;
    console.log(`  ${ok ? "ok  " : "BAD "} ${source}`);
    console.log(`       ${result || "(empty)"}\n`);
  }

  console.log(`  ${SAMPLES.length} phrases in ${took} ms.\n`);

  if (bad > 0) {
    console.error(
      `  ${bad} came back without Malayalam in them. The call succeeded, so\n` +
        `  this is the provider's answer rather than a connection problem —\n` +
        `  check the target language is right for the account.\n`,
    );
    process.exitCode = 1;
    return;
  }

  /*
   * Second pass through the real path, to prove the cache is doing its job.
   *
   * A working key with a broken cache means every grower scrolling their work
   * log bills again for the same sentence — the failure is a slow page and an
   * unexplained invoice, not an error, so nothing else would catch it.
   */
  const first = Date.now();
  await translateMany(SAMPLES, "ml");
  const cold = Date.now() - first;

  const second = Date.now();
  const warm = await translateMany(SAMPLES, "ml");
  const hot = Date.now() - second;

  const cached = warm.every((v, i) => MALAYALAM.test(v) && v !== SAMPLES[i]);
  console.log(`  Cache: ${cold} ms cold, ${hot} ms warm.`);

  if (!cached) {
    console.error(`\n  The cached read did not return Malayalam. Something is\n` +
      `  wrong in the cache rather than the provider.\n`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n  Working. Growers on മലയാളം will now see Jinto's notes translated,\n` +
      `  each one paid for once.\n\n` +
      `  The quality is a separate question, and not one either of us can\n` +
      `  answer — ask Jinto to read a few real notes before you rely on it.\n`,
  );
}

await main();
