import assert from "node:assert";
import path from "node:path";
import test, { describe } from "node:test";
import { jsonFiles, keysOf, LOCALES_DIR, readLocale, SOURCE_LOCALE } from ".";

const FILE_NAME = /^[a-z0-9-]+\.json$/;
// A key is an identifier, never prose: ASCII, no spaces, nothing but letters,
// digits, `-` and `_`.
//
// Most are kebab-case because someone wrote them. The ones that mirror a name
// something else already gave keep that spelling: `buyCredits` is the field a
// table column reads, `grand_battle` and `AT-SPG` are the tokens the game
// itself uses. Renaming those to satisfy a style rule would only put a lookup
// table between a thing and its own name, which is the bug this file exists to
// prevent, not the style it enforces.
const KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/**
 * Conventions on the English files only, since they are the ones written by
 * hand. The namespace is the path from `src/locales/<locale>/`, so a file name
 * is a piece of the identifier every call site types.
 */
export function namingTests() {
  const sourceFiles = jsonFiles(path.join(LOCALES_DIR, SOURCE_LOCALE));

  describe("Locales naming", () => {
    test("file names are lowercase or kebab-case", () => {
      const invalid = sourceFiles.filter(
        (file) => !FILE_NAME.test(path.basename(file)),
      );
      assert.deepStrictEqual(invalid, []);
    });

    test("keys are lowercase or kebab-case ASCII", () => {
      const invalid: string[] = [];
      for (const file of sourceFiles)
        for (const key of keysOf(readLocale(SOURCE_LOCALE, file)))
          if (key.split(".").some((segment) => !KEY_SEGMENT.test(segment)))
            invalid.push(`${file}: ${key}`);
      assert.deepStrictEqual(
        invalid,
        [],
        "Keys are identifiers, not prose: ASCII, no spaces, kebab-case unless they mirror a name the code or the game already gave.",
      );
    });
  });
}
