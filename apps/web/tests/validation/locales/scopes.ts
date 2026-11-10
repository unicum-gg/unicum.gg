import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { moduleGraph } from "../../../scripts/module-graph";
import { SRC_DIR } from ".";
import { SERVER_ONLY_NAMESPACES } from "../../../src/lib/translations";
import {
  CHROME_NAMESPACES,
  ROUTE_NAMESPACES,
} from "../../../src/locales/generated/scopes";

const CLIENT_DIRECTIVE = /^\s*["']use client["']/m;
/** The files Next renders a route through, which is where rendering starts. */
const ROUTER_FILES = [
  "page.tsx",
  "layout.tsx",
  "not-found.tsx",
  "error.tsx",
  "global-error.tsx",
  "template.tsx",
  "default.tsx",
];
const CLIENT_CALL = /useTranslation\(\s*"([^"]+)"/g;

/** The file a scope belongs to. A layout's key ends in `/layout`, since a
 * layout and a page share a folder.
 *
 * `SRC_DIR` is read here rather than at the top of the file: the suite's index
 * imports this module, so a module-level read of it runs before the index has
 * finished initialising and throws on the import. */
function fileOf(scope: string): string {
  const app = path.join(SRC_DIR, "app");
  const parts = scope.split("/");
  return parts.at(-1) === "layout"
    ? path.join(app, ...parts.slice(0, -1), "layout.tsx")
    : path.join(app, ...parts, "page.tsx");
}

/**
 * The scoping is only correct if both halves hold, and each half fails in a way
 * nothing else reports.
 *
 * `scripts/generate-locale-scopes` says what each route reads; the route itself
 * has to ASK for it, through `withDictionaries` at its export or a
 * `Dictionaries` in its tree. A route that does not gets the chrome and nothing
 * else, which is 42 namespaces of navigation and footer, and renders its own
 * keys everywhere else on the page. It type-checks and it lints, because a
 * route needing no scope is a real state (five of them add nothing), so the
 * only signal is the page itself.
 */
export function scopeTests() {
  describe("Locales scopes", () => {
    test("every route that needs a scope asks for it", () => {
      const silent: string[] = [];
      for (const [scope, namespaces] of Object.entries(ROUTE_NAMESPACES)) {
        if (namespaces.length === 0) continue;
        const file = fileOf(scope);
        if (!fs.existsSync(file)) {
          silent.push(`${scope}: no file at ${path.relative(SRC_DIR, file)}`);
          continue;
        }
        if (!fs.readFileSync(file, "utf-8").includes(JSON.stringify(scope))) {
          silent.push(path.relative(SRC_DIR, file));
        }
      }
      assert.deepStrictEqual(
        silent.sort(),
        [],
        'These read strings the browser will not have: the chrome is all they would get. Wrap the export in `withDictionaries("<route>", Page)`, or render `<Dictionaries locale={locale} scope="<route>">` in a layout.',
      );
    });

    /**
     * The other direction: a namespace read in the browser that landed in no
     * scope at all.
     *
     * This is what the set arithmetic can get wrong, and it got it wrong once
     * already: a scoped layout counted ITSELF among the scoped layouts above
     * it and subtracted its own set, so its key came out empty while its pages
     * inherited what it was no longer carrying, and every tank and map tab
     * would have rendered its tab bar as slugs.
     *
     * A file no route can reach is skipped rather than failed, and named
     * instead: nothing renders it, so nobody can read its keys. There are
     * three, each a module with a namespace of its own that nothing imports.
     */
    test("every namespace a client component reads is shipped somewhere", () => {
      const shipped = new Set<string>([
        ...(CHROME_NAMESPACES as readonly string[]),
        ...Object.values(ROUTE_NAMESPACES).flat(),
      ]);
      const graph = moduleGraph(SRC_DIR, [path.join(SRC_DIR, "locales")]);
      const routes = graph.files.filter(
        (file) =>
          file.startsWith(path.join(SRC_DIR, "app") + path.sep) &&
          ROUTER_FILES.some((name) => file.endsWith(path.sep + name)),
      );
      const rendered = graph.closure(routes);

      const stripped: string[] = [];
      const orphans = new Set<string>();
      for (const file of graph.files) {
        const content = graph.source.get(file) ?? "";
        if (!CLIENT_DIRECTIVE.test(content)) continue;
        for (const match of content.matchAll(CLIENT_CALL)) {
          // A server-only namespace is refused by `usage`, which says what to
          // do about it; reporting it twice would hide that advice.
          if (SERVER_ONLY_NAMESPACES.includes(match[1])) continue;
          if (shipped.has(match[1])) continue;
          const where = `${path.relative(SRC_DIR, file)}: ${match[1]}`;
          if (rendered.has(file)) stripped.push(where);
          else orphans.add(where);
        }
      }

      if (orphans.size)
        console.log(
          `\n  note: ${orphans.size} namespace(s) read by a module no route renders:\n${[...orphans]
            .sort()
            .map((o) => `    - ${o}`)
            .join("\n")}\n`,
        );
      assert.deepStrictEqual(
        stripped.sort(),
        [],
        "These are read in the browser and reach no route's scope, so they render as their own keys. Run `pnpm --filter @unicum.gg/web locale-scopes`; if that does not fix it, the scope arithmetic is dropping them.",
      );
    });
  });
}
