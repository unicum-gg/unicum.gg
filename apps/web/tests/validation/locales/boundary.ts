import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { LOCALES_DIR, SRC_DIR } from ".";

const CLIENT_DIRECTIVE = /^\s*["']use client["']/m;
const HOOK = /\buseTranslation\(/;
const IMPORT = /from\s+"([^"]+)"/g;

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

/** Resolve one import specifier to a file in the tree, or null if it leaves it. */
function resolve(
  specifier: string,
  from: string,
  files: Set<string>,
): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(SRC_DIR, specifier.slice(2));
  else if (specifier.startsWith("."))
    base = path.normalize(path.join(path.dirname(from), specifier));
  else return null;
  for (const candidate of [
    `${base}.tsx`,
    `${base}.ts`,
    path.join(base, "index.tsx"),
    path.join(base, "index.ts"),
  ]) {
    if (files.has(candidate)) return candidate;
  }
  return null;
}

/**
 * `useTranslation` is a client hook, so a server component that calls it throws
 * at request time: "Attempted to call useTranslation() from the server".
 *
 * Nothing else catches this. It type-checks, it lints, and the file itself looks
 * fine, because whether a component runs on the server is decided by who renders
 * it: the same file is a client component when every path to it crosses a
 * `"use client"` boundary, and a server one when any path does not. So this walks
 * the import graph the way React does and fails on a file the hook can reach
 * from a page. Found three of them (`leaderboard-tabs`, `strict-mode-toggle`,
 * the glossary term view), each of which only showed as a runtime error on the
 * one page that rendered it.
 *
 * The fix is `getTranslation(namespace, locale)` and a `locale` prop, not a
 * `"use client"` directive: these components are content, and shipping them to
 * the browser to read two strings is the wrong half of the trade.
 */
export function boundaryTests() {
  describe("Locales boundary", () => {
    test("no server component calls the client hook", () => {
      const paths = sourceFiles(SRC_DIR);
      const files = new Set(paths);
      const source = new Map(
        paths.map((p) => [p, fs.readFileSync(p, "utf-8")] as const),
      );
      const isClient = (p: string) =>
        CLIENT_DIRECTIVE.test(source.get(p) ?? "");

      // Who imports whom, so a file can be asked how it is reached.
      const importers = new Map<string, Set<string>>(
        paths.map((p) => [p, new Set<string>()]),
      );
      for (const [file, text] of source) {
        for (const match of text.matchAll(IMPORT)) {
          const target = resolve(match[1], file, files);
          if (target) importers.get(target)?.add(file);
        }
      }

      // Reachable from the server when some import chain arrives without ever
      // crossing a "use client" boundary. A file nothing imports is a route
      // root, which is a server component by default.
      const reachable = (file: string, seen = new Set<string>()): boolean => {
        if (seen.has(file)) return false;
        seen.add(file);
        if (isClient(file)) return false;
        const from = importers.get(file);
        if (!from || from.size === 0) return true;
        return [...from].some((parent) => reachable(parent, seen));
      };

      const broken = paths
        .filter(
          (p) => !isClient(p) && HOOK.test(source.get(p) ?? "") && reachable(p),
        )
        .map((p) => path.relative(SRC_DIR, p))
        .sort();

      assert.deepStrictEqual(
        broken,
        [],
        "`useTranslation` is a client hook and these are reachable from a server render. Take a `locale` prop and call `getTranslation` instead.",
      );
    });
  });
}
