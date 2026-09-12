import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { LOCALES_DIR, SRC_DIR } from ".";

/**
 * `"use client"` has to be the first statement in the file.
 *
 * This is here rather than left to the compiler because nothing else sees it.
 * The directive is a string expression: an import inserted above it is valid
 * TypeScript, lints clean, and demotes the file to a server component, where
 * `useTranslation` throws at the one reader who opens the page that renders it.
 * Every automated edit that adds an import to a client component can cause it,
 * and it happened three times over the i18n port before this check existed.
 */
const DIRECTIVE = /^["']use (client|server)["'];?$/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === path.join(LOCALES_DIR, "generated")) continue;
      out.push(...sourceFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/** The line the directive sits on, and the first line of real code before it.
 * Comments and blank lines are allowed above: the runtime skips them too. */
function misplacedDirective(file: string): string | null {
  const lines = fs.readFileSync(file, "utf-8").split("\n");
  let code: number | null = null;
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (inBlockComment) {
      if (line.includes("*/")) inBlockComment = false;
      continue;
    }
    if (line === "" || line.startsWith("//")) continue;
    if (line.startsWith("/*")) {
      if (!line.includes("*/")) inBlockComment = true;
      continue;
    }
    if (DIRECTIVE.test(line)) {
      return code === null
        ? null
        : `${path.relative(SRC_DIR, file)}:${i + 1}: ${line} sits below code from line ${code + 1}`;
    }
    if (code === null) code = i;
  }
  return null;
}

export function directiveTests() {
  describe("Locales directive", () => {
    test("a use-client directive is the first statement in its file", () => {
      const offenders = sourceFiles(SRC_DIR)
        .map(misplacedDirective)
        .filter((v): v is string => v !== null)
        .sort();
      assert.deepStrictEqual(
        offenders,
        [],
        "A directive below any statement is inert, so the file silently became a server component. Move it back to the top.",
      );
    });
  });
}
