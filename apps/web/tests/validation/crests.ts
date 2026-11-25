import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { PLAYER_CREST_KEYS } from "../../../../packages/shared/src/players/crests";

/**
 * A player's crests reach their name through `crestsOf`, never field by field.
 *
 * Copied out by hand, a crest added later has to be added to every table that
 * draws a name, and nothing says which one was forgotten: the server sends it,
 * the types allow its absence, and the row simply wears one crest fewer than
 * the profile. It happened with the winner's crest and again with Onslaught's,
 * both times in the clan's own roster. So a crest field copied off a row
 * (`tournamentWins: m.tournamentWins,`) anywhere a page is rendered fails here.
 */
const SRC_DIR = path.resolve(__dirname, "../../src");
const ROOTS = ["components", "app"].map((d) => path.join(SRC_DIR, d));
/** The API builds payloads rather than drawing names. */
const SKIPPED = [path.join(SRC_DIR, "app", "api")];

const COPIED = new RegExp(
  `^\\s*(${PLAYER_CREST_KEYS.join("|")}):\\s*[\\w$]+(?:\\??\\.[\\w$]+)*\\??\\.\\1,?\\s*$`,
);

function sourceFiles(dir: string): string[] {
  if (SKIPPED.includes(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

export function crestsTests() {
  describe("crests", () => {
    test("no crest field is copied off a row by hand", () => {
      const offenders: string[] = [];
      for (const file of ROOTS.flatMap(sourceFiles)) {
        const lines = fs.readFileSync(file, "utf-8").split("\n");
        lines.forEach((line, i) => {
          if (COPIED.test(line)) {
            offenders.push(`${path.relative(SRC_DIR, file)}:${i + 1}  ${line.trim()}`);
          }
        });
      }
      assert.deepEqual(
        offenders,
        [],
        `Spread \`...crestsOf(row)\` instead of listing crest fields:\n${offenders.join("\n")}`,
      );
    });
  });
}
