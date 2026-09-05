/**
 * Teach Node the two things Next resolves for free.
 *
 * The scripts in here import application modules directly, under type
 * stripping, so that what they check is the code that ships rather than a copy
 * of it. Node resolves neither the "@/" alias from tsconfig nor an
 * extensionless ".ts" import, and both appear throughout src/ — so without
 * this, only modules that happen to import nothing are testable, which is
 * exactly the modules least worth testing.
 *
 * Import it for the side effect, before importing anything from src/:
 *
 *   import "./resolve-app-imports.mjs";
 *   const { thing } = await import("@/lib/thing");
 *
 * The static import runs first, so the dynamic import below it sees the hook.
 * A plain `import { thing } from "@/lib/thing"` at the top of the file would
 * not — every static import in a module is resolved before any of its code
 * runs, hook included.
 */
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(fileURLToPath(import.meta.url), "../../src");

registerHooks({
  resolve(specifier, context, next) {
    let target = null;

    if (specifier.startsWith("@/")) {
      target = path.join(SRC, specifier.slice(2));
    } else if (
      /^\.{1,2}\//.test(specifier) &&
      context.parentURL?.startsWith("file:")
    ) {
      // A relative import that resolves on its own is left alone; only the
      // extensionless ones need help, and guessing at a path that already
      // works is how you shadow the wrong file.
      const guess = path.resolve(fileURLToPath(context.parentURL), "..", specifier);
      if (!existsSync(guess)) target = guess;
    }

    if (target) {
      for (const suffix of [".ts", ".tsx", "/index.ts", ""]) {
        if (existsSync(target + suffix)) {
          return { url: pathToFileURL(target + suffix).href, shortCircuit: true };
        }
      }
    }

    return next(specifier, context);
  },
});
