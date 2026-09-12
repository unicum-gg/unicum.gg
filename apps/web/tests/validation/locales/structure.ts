import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { LOCALES } from "../../../src/lib/translations";
import { GENERATED_DIR, LOCALES_DIR } from ".";

export function structureTests() {
  describe("Locales structure", () => {
    test("every declared locale has a folder", () => {
      const missing = LOCALES.filter(
        (locale) => !fs.existsSync(path.join(LOCALES_DIR, locale)),
      );
      assert.deepStrictEqual(
        missing,
        [],
        `A locale in the enum with no strings on disk renders as English forever: run \`pnpm translate\`.`,
      );
    });

    test("no folder that is not a declared locale", () => {
      const extra = fs
        .readdirSync(LOCALES_DIR)
        .filter((entry) =>
          fs.statSync(path.join(LOCALES_DIR, entry)).isDirectory(),
        )
        .filter((entry) => entry !== GENERATED_DIR)
        .filter((entry) => !(LOCALES as readonly string[]).includes(entry));
      assert.deepStrictEqual(
        extra,
        [],
        "A folder no locale points at is dead weight the generator still walks.",
      );
    });
  });
}
