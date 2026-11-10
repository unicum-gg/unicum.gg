// The import graph of `src`, read the way the bundler reads it.
//
// Shared by the two locale generators, which both ask a question about
// reachability rather than about any one file: `generate-locales` asks which
// namespaces the browser bundle can read at all, and `generate-locale-scopes`
// asks which ones each route can. `tests/validation/locales/boundary` asks the
// mirror image (can a SERVER render reach the client hook) and keeps its own
// walk, since it follows importers backwards rather than imports forwards.
//
// It is a regex read of the sources rather than a real resolver. That is enough
// here because every path in this tree is either relative or `@/`-aliased and
// every module is a file, and it is deliberate rather than lazy: a generator on
// `postinstall` must not need a TypeScript program, and the answer only has to
// be conservative in the direction where being wrong costs bytes.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

/** `"use client"`, which has to be the file's first statement to count (the
 * locale suite's `directive` test is what holds the tree to that). */
const CLIENT_DIRECTIVE = /^\s*["']use client["']/m;

/** Every static and dynamic import of a path. A specifier that leaves the tree
 * resolves to null and is dropped, so a package is never followed. */
const IMPORT = /(?:from\s+"([^"]+)")|(?:import\(\s*"([^"]+)"\s*\))/g;

export type ModuleGraph = {
  /** Every file in the tree, absolute. */
  files: readonly string[];
  /** Each file's source, read once. */
  source: ReadonlyMap<string, string>;
  /** What each file imports, resolved to files in the tree. */
  imports: ReadonlyMap<string, readonly string[]>;
  /** Whether a file carries the client directive. */
  isClient: (file: string) => boolean;
  /** Every file reachable from these roots, the roots included. */
  closure: (roots: readonly string[]) => Set<string>;
};

/** Every `.ts`/`.tsx` under `dir`, skipping the directories named. */
function sourceFiles(
  dir: string,
  skip: readonly string[],
  out: string[] = [],
): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (skip.includes(full)) continue;
    if (entry.isDirectory()) sourceFiles(full, skip, out);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
      out.push(full);
  }
  return out;
}

/** Resolve one import specifier to a file in the tree, or null if it leaves it. */
function resolveImport(
  specifier: string,
  from: string,
  srcRoot: string,
  files: Set<string>,
): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(srcRoot, specifier.slice(2));
  else if (specifier.startsWith("."))
    base = normalize(join(dirname(from), specifier));
  else return null;
  for (const candidate of [
    `${base}.tsx`,
    `${base}.ts`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
  ]) {
    if (files.has(candidate)) return candidate;
  }
  return null;
}

export function moduleGraph(
  srcRoot: string,
  skip: readonly string[] = [],
): ModuleGraph {
  const paths = sourceFiles(srcRoot, skip);
  const files = new Set(paths);
  const source = new Map(
    paths.map((file) => [file, readFileSync(file, "utf-8")] as const),
  );
  const imports = new Map<string, readonly string[]>(
    paths.map((file) => [
      file,
      [...(source.get(file) ?? "").matchAll(IMPORT)]
        .map((match) =>
          resolveImport(match[1] ?? match[2], file, srcRoot, files),
        )
        .filter((target): target is string => target !== null),
    ]),
  );

  return {
    files: paths,
    source,
    imports,
    isClient: (file) => CLIENT_DIRECTIVE.test(source.get(file) ?? ""),
    closure: (roots) => {
      const seen = new Set<string>();
      const stack = [...roots];
      while (stack.length > 0) {
        const file = stack.pop() as string;
        if (seen.has(file)) continue;
        seen.add(file);
        for (const target of imports.get(file) ?? []) {
          if (!seen.has(target)) stack.push(target);
        }
      }
      return seen;
    },
  };
}
