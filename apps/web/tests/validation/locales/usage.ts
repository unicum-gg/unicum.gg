import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import {
  jsonFiles,
  keysOf,
  LOCALES_DIR,
  readLocale,
  SOURCE_LOCALE,
  SRC_DIR,
} from ".";
import { SERVER_ONLY_NAMESPACES } from "../../../src/lib/translations";

const CALL = /(?:useTranslation|getTranslation)\(\s*"([^"]+)"/g;
/** Only the client half: `getTranslation` runs on the server by construction. */
const CLIENT_CALL = /useTranslation\(\s*"([^"]+)"/g;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // The generated per-locale modules import every namespace by construction,
      // so counting them would make every key look used.
      if (full === path.join(LOCALES_DIR, "generated")) continue;
      out.push(...sourceFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * What the code asks for, so the tree can be compared against it.
 *
 * A namespace that no longer exists is already a compile error (the generated
 * `Namespace` union), so the useful direction is the other one: strings we pay a
 * model to translate into 26 languages that nothing renders. Reported rather
 * than failed, because a key can legitimately be reached through a computed
 * one (`t(\`links.${id}.label\`)`), which no scan of this kind can see.
 */
export function usageTests() {
  describe("Locales usage", () => {
    test("no namespace nothing reads", () => {
      const used = new Set<string>();
      for (const file of sourceFiles(SRC_DIR)) {
        const content = fs.readFileSync(file, "utf-8");
        for (const match of content.matchAll(CALL)) used.add(match[1]);
      }

      const unused = jsonFiles(path.join(LOCALES_DIR, SOURCE_LOCALE))
        .map((file) => file.replace(/\.json$/, "").split(path.sep).join("/"))
        .filter((namespace) => !used.has(namespace));

      if (unused.length)
        console.log(
          `\n  note: ${unused.length} namespace(s) nothing imports:\n${unused.map((n) => `    - ${n}`).join("\n")}\n`,
        );
    });

    // A server-only namespace never reaches the browser, so a client component
    // reading one gets its key back and renders it at a reader. Nothing else
    // catches this: it type-checks, it lints, and it only shows on the page.
    test("no client component reads a server-only namespace", () => {
      const leaked: string[] = [];
      for (const file of sourceFiles(SRC_DIR)) {
        const content = fs.readFileSync(file, "utf-8");
        if (!/^\s*["']use client["']/m.test(content)) continue;
        for (const match of content.matchAll(CLIENT_CALL)) {
          if (SERVER_ONLY_NAMESPACES.includes(match[1])) {
            leaked.push(`${path.relative(SRC_DIR, file)}: ${match[1]}`);
          }
        }
      }
      assert.deepStrictEqual(
        leaked,
        [],
        "A server-only namespace is stripped before the dictionaries cross the wire, so `useTranslation` on one returns the key. Resolve it in a server component and pass the string down.",
      );
    });

    test("English holds no empty string", () => {
      const empty: string[] = [];
      for (const file of jsonFiles(path.join(LOCALES_DIR, SOURCE_LOCALE))) {
        const source = readLocale(SOURCE_LOCALE, file);
        for (const key of keysOf(source)) {
          const value = key
            .split(".")
            .reduce<unknown>(
              (node, segment) =>
                node && typeof node === "object"
                  ? (node as Record<string, unknown>)[segment]
                  : undefined,
              source,
            );
          if (typeof value === "string" && value.trim() === "")
            empty.push(`${file}: ${key}`);
        }
      }
      if (empty.length)
        console.log(`\n  note: empty strings:\n${empty.join("\n")}\n`);
    });
    /**
     * A key a component reads but nothing defines renders as its own slug at a
     * reader: `add-the-bot-to-your` where a sentence should be.
     *
     * Nothing else catches it. It type-checks (the namespace is typed, the key
     * is not), it lints, and the page renders: the reader simply sees the key.
     * It found eighteen files at once, all from the same mistake, a component
     * binding two namespaces and the keys of one being looked up in the other.
     *
     * Resolution is lexical, the way the code reads: a call belongs to the
     * NEAREST binding above it with the same name, since a file may hold two
     * components that each bind their own `t`.
     */
    test("every key a component reads is defined", () => {
      const defined = new Map<string, Set<string>>();
      for (const file of jsonFiles(path.join(LOCALES_DIR, SOURCE_LOCALE))) {
        defined.set(
          file.replace(/\.json$/, ""),
          new Set(keysOf(readLocale(SOURCE_LOCALE, file))),
        );
      }

      const BIND =
        /const \{\s*t(?:\s*:\s*(\w+))?\s*\}\s*=\s*(?:await\s+)?(?:use|get)Translation\(\s*\n?\s*"([^"]+)"/g;
      const READ = /\b(\w+)\("([a-z0-9][a-z0-9.-]*)"/g;

      const missing: string[] = [];
      for (const file of sourceFiles(SRC_DIR)) {
        const text = fs.readFileSync(file, "utf-8");
        const binds = [...text.matchAll(BIND)].map((m) => ({
          at: m.index ?? 0,
          name: m[1] ?? "t",
          namespace: m[2],
        }));
        if (binds.length === 0) continue;
        for (const read of text.matchAll(READ)) {
          const at = read.index ?? 0;
          const bound = binds
            .filter((b) => b.at < at && b.name === read[1])
            .at(-1);
          if (!bound) continue;
          const keys = defined.get(bound.namespace);
          if (keys && !keys.has(read[2])) {
            missing.push(
              `${path.relative(SRC_DIR, file)}: ${read[1]}("${read[2]}") is not in ${bound.namespace}`,
            );
          }
        }
      }
      assert.deepStrictEqual(
        missing.sort(),
        [],
        "These render their own key at a reader. Define them, or read them from the namespace that holds them.",
      );
    });
  });
}
