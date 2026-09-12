import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { SRC_DIR } from ".";

/**
 * The catalogues a helper owns, and the file allowed to read each one.
 *
 * `game/vocabulary` is a flat map of the game's own words, and two of its
 * families cannot be read straight: a battle type because one of its names is
 * built from another (`{onslaught} Night`), and a map mode because the key a
 * reader has is not always the key the catalogue holds (a geometry change
 * carries the client's raw `ctf`, the catalogue is keyed `standard`).
 */
const OWNED: { family: string; helper: string; why: string }[] = [
  {
    family: "battle-types",
    helper: "battleTypeName",
    why: "`battle-types.onslaught_night` is \"{onslaught} Night\", and only the helper fills that in. Read raw, it renders the placeholder at the reader.",
  },
  {
    family: "map-modes",
    helper: "mapModeName",
    why: "A mode arrives as the client's own token (`ctf`, `comp7`), which the catalogue does not carry. Read raw, it answers with the key and the caller falls back to English.",
  },
];

export function vocabularyTests() {
  describe("Locales vocabulary", () => {
    /**
     * Both bugs this catches shipped, and neither is visible in review.
     *
     * A raw read type-checks, lints, passes every other check in this suite and
     * renders in English or, worse, renders `Version {onslaught} de nuit` at a
     * French reader. The helpers' own JSDoc has always said everything goes
     * through them, and three call sites did not.
     */
    test("nothing reads the game's own catalogue behind its helper", () => {
      const offenders: string[] = [];
      // Resolved here rather than at module load: `SRC_DIR` lives in the
      // suite's own index, which imports this file, so reading it at the top
      // level runs before it is initialised.
      const home = path.join(SRC_DIR, "components", "game-name.ts");
      for (const file of tsFiles(SRC_DIR)) {
        if (path.resolve(file) === path.resolve(home)) continue;
        const source = fs.readFileSync(file, "utf-8");
        for (const { family, helper, why } of OWNED) {
          // Both spellings a call site uses: a template key built from a
          // variable, and a plain string key. The callee has to look like a
          // translate function, or the helper's own guard against an
          // unresolved key (`qualifier.startsWith("battle-types.")`) reads as
          // a read of the catalogue.
          const pattern = new RegExp(
            String.raw`(?<![.\w])t[A-Za-z]*\(\s*(?:\`${family}\.|["']${family}\.)`,
          );
          if (pattern.test(source))
            offenders.push(
              `${path.relative(SRC_DIR, file)} reads ${family}.* directly. Call ${helper}() instead: ${why}`,
            );
        }
      }
      assert.deepStrictEqual(offenders, []);
    });
  });
}

/** Every `.ts`/`.tsx` under a directory, the way the sibling checks walk it. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "generated" || entry.name === "locales") continue;
      out.push(...tsFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}
