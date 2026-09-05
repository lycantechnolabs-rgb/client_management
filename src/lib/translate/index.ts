import { createHash } from "node:crypto";

import { db } from "@/lib/db";

/**
 * Machine translation of what Jinto writes.
 *
 * The interface strings are a fixed catalogue with a human review screen. This
 * is the other half: the titles and notes he types into the work log, which a
 * grower who reads only Malayalam otherwise cannot read at all — and which are
 * the actual content they signed in for.
 *
 * Three things shape this design, and all three are consequences of sending
 * text to somebody else's computer:
 *
 * **It is off unless configured.** No key, no calls, and the grower sees the
 * English exactly as now. A missing key must never mean a broken page.
 *
 * **Everything is cached, keyed by a hash of the source.** A note is translated
 * once, not on every page load — otherwise a grower scrolling their work log
 * bills for the same paragraph a dozen times, and the page waits on the network
 * to render. Editing the note changes the hash, so a correction is picked up.
 *
 * **It fails open, to English.** A provider that is down, rate-limited or
 * refusing the key must degrade to the original text rather than a blank card.
 *
 * The DPDP position is written up in docs/dpdp/translation.md and is not
 * incidental: enabling this makes the provider a Data Processor handling
 * estate notes, and that is a decision with paperwork attached, not a setting.
 */

export type TranslateProvider = {
  name: string;
  /** Translate a batch. Must return one result per input, in order. */
  translate(texts: string[], target: string): Promise<string[]>;
};

/** How long a cached translation stays good. Source changes bypass this. */
const MAX_TEXT_LENGTH = 4000;

function hashOf(text: string, target: string) {
  return createHash("sha256").update(`${target} ${text}`).digest("hex").slice(0, 40);
}

/* -------------------------------------------------------------------------- */
/* providers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Google Cloud Translation v2, which is the simplest of the paid options: one
 * POST, an API key in the query string, no OAuth dance.
 */
function googleProvider(key: string): TranslateProvider {
  return {
    name: "google",
    async translate(texts, target) {
      const res = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ q: texts, target, format: "text" }),
        },
      );
      if (!res.ok) throw new Error(`google translate ${res.status}`);
      const body = await res.json();
      const out = body?.data?.translations;
      if (!Array.isArray(out) || out.length !== texts.length) {
        throw new Error("google translate returned a different number of results");
      }
      return out.map((t: { translatedText: string }) => t.translatedText);
    },
  };
}

/**
 * Azure Translator.
 *
 * Worth reaching for first rather than last: the F0 tier is free permanently
 * rather than for a trial year, and its two million characters a month is far
 * more than an estate book will ever produce — a work-log note runs to a
 * hundred characters or so. Malayalam is on its supported list, checked against
 * the live /languages endpoint rather than assumed.
 */
function azureProvider(key: string, region?: string): TranslateProvider {
  return {
    name: "azure",
    async translate(texts, target) {
      const res = await fetch(
        `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${encodeURIComponent(target)}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "Ocp-Apim-Subscription-Key": key,
            // Only when there is one to send. A regional resource requires this
            // header and a global one does not, and defaulting it to a guessed
            // region — which this did — makes a global key fail authentication
            // for a reason nothing in the error explains.
            ...(region ? { "Ocp-Apim-Subscription-Region": region } : {}),
          },
          body: JSON.stringify(texts.map((text) => ({ Text: text }))),
        },
      );
      if (!res.ok) throw new Error(`azure translate ${res.status}`);
      const body = await res.json();
      if (!Array.isArray(body) || body.length !== texts.length) {
        throw new Error("azure translate returned a different number of results");
      }
      return body.map((r: { translations: { text: string }[] }) => r.translations[0].text);
    },
  };
}

export function provider(): TranslateProvider | null {
  const which = (process.env.TRANSLATE_PROVIDER ?? "none").toLowerCase();
  if (which === "google" && process.env.GOOGLE_TRANSLATE_KEY) {
    return googleProvider(process.env.GOOGLE_TRANSLATE_KEY);
  }
  if (which === "azure" && process.env.AZURE_TRANSLATE_KEY) {
    return azureProvider(
      process.env.AZURE_TRANSLATE_KEY,
      process.env.AZURE_TRANSLATE_REGION || undefined,
    );
  }
  return null;
}

export const translationEnabled = () => provider() !== null;

/* -------------------------------------------------------------------------- */
/* the cached translator                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Translate a batch of strings, using the cache and falling back to the source.
 *
 * Batched on purpose: a work log renders twenty titles and twenty notes, and
 * forty round trips would be slower than the page is worth and cost forty times
 * the minimum charge. One call, one row each.
 */
export async function translateMany(
  texts: (string | null | undefined)[],
  target: string,
): Promise<string[]> {
  const source = texts.map((t) => (t ?? "").trim());

  /*
   * The cache is read whether or not a provider is configured.
   *
   * This used to return early with no provider, which quietly made every
   * translation Jinto typed by hand invisible — a deployment with no API key
   * would store his Malayalam and then never look at it. The provider is only
   * needed to *fill* a gap, never to read one that is already filled.
   */
  if (target === "en" || source.every((s) => !s)) {
    return source;
  }
  const p = provider();

  const wanted = [...new Set(source.filter((s) => s && s.length <= MAX_TEXT_LENGTH))];
  if (wanted.length === 0) return source;

  const hashes = new Map(wanted.map((text) => [text, hashOf(text, target)]));

  let cached: { hash: string; value: string }[] = [];
  try {
    cached = await db.contentTranslation.findMany({
      where: { hash: { in: [...hashes.values()] } },
      select: { hash: true, value: true },
    });
  } catch {
    // A cache that cannot be read is a slow page, not a broken one.
  }
  const byHash = new Map(cached.map((r) => [r.hash, r.value]));

  const missing = wanted.filter((text) => !byHash.has(hashes.get(text)!));

  // Anything still missing needs the provider. Without one this is where we
  // stop, and the caller gets the English back for those — which is the whole
  // fallback chain in one line: typed Malayalam, then machine, then English.
  if (missing.length > 0 && p) {
    try {
      const translated = await p.translate(missing, target);
      missing.forEach((text, i) => byHash.set(hashes.get(text)!, translated[i]));

      // Written after the fact and never awaited for correctness: a failed
      // cache write costs a repeat call, not a wrong page.
      await db.contentTranslation
        .createMany({
          data: missing.map((text, i) => ({
            hash: hashes.get(text)!,
            locale: target,
            source: text.slice(0, MAX_TEXT_LENGTH),
            value: translated[i],
            provider: p.name,
          })),
        })
        .catch(() => {});
    } catch (error) {
      // Fail open. A grower reading English is a worse experience than reading
      // Malayalam; a grower reading an error page cannot use the portal at all.
      console.warn(
        `[translate] ${p.name} failed, falling back to the original text —`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return source.map((text) => {
    if (!text) return text;
    const hash = hashes.get(text);
    return (hash && byHash.get(hash)) ?? text;
  });
}

/** One string, for the places that only need one. */
export async function translateOne(
  text: string | null | undefined,
  target: string,
): Promise<string> {
  const [out] = await translateMany([text], target);
  return out;
}
