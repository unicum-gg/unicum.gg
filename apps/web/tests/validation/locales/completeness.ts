import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import {
  jsonFiles,
  keysOf,
  LOCALES_DIR,
  readLocale,
  SOURCE_LOCALE,
  targetLocales,
} from ".";

/**
 * English is the source and every other locale is generated from it, so these
 * are not style checks: a missing file or key is a string the reader sees in
 * English on an otherwise translated page, and an extra one is a string nothing
 * reads any more.
 */
export function completenessTests() {
  const sourceFiles = jsonFiles(path.join(LOCALES_DIR, SOURCE_LOCALE));

  describe("Locales completeness", () => {
    test("every English file exists in every locale", () => {
      const missing: string[] = [];
      for (const locale of targetLocales)
        for (const file of sourceFiles)
          if (!fs.existsSync(path.join(LOCALES_DIR, locale, file)))
            missing.push(`${locale}/${file}`);
      assert.deepStrictEqual(missing, [], `Run \`pnpm translate\`.`);
    });

    test("every English key exists in every locale, and no other", () => {
      const missing: string[] = [];
      const extra: string[] = [];
      for (const file of sourceFiles) {
        const sourceKeys = keysOf(readLocale(SOURCE_LOCALE, file));
        for (const locale of targetLocales) {
          if (!fs.existsSync(path.join(LOCALES_DIR, locale, file))) continue;
          const targetKeys = keysOf(readLocale(locale, file));
          for (const key of sourceKeys)
            if (!targetKeys.includes(key)) missing.push(`${locale}/${file}: ${key}`);
          for (const key of targetKeys)
            if (!sourceKeys.includes(key)) extra.push(`${locale}/${file}: ${key}`);
        }
      }
      assert.deepStrictEqual(missing, [], `Run \`pnpm translate\`.`);
      assert.deepStrictEqual(
        extra,
        [],
        "Keys English has dropped. `pnpm translate` rewrites each file from the English shape, so a run clears these.",
      );
    });
  });
}
