// Generates `src/locales/generated/`: one module per locale importing every
// translation file that locale carries, plus an index exposing the namespace
// list and a per-locale loader.
//
// The dictionaries are bundled rather than read from disk at runtime. The
// server build is `output: "standalone"`, which ships only what the tracer sees,
// so a `fs.readFile` of `src/locales` would be one more asset to remember to
// copy next to `server.js` and would fail silently in production the day someone
// forgot. A generated static import cannot be forgotten: it either compiles or
// it does not.
//
// English is the source of truth for the namespace list. The other locales are
// written by CI from it, so a locale that is behind simply imports fewer files
// and falls back to English key by key at runtime.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, normalize, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_LOCALE, LOCALES } from "../src/lib/translations";
import { statLabelKey } from "../src/components/stat-label";
import { cataloguedLabelKeys } from "./translation-rules";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(webRoot, "src");
const localesRoot = join(srcRoot, "locales");
const outDir = join(localesRoot, "generated");

/** Every `*.json` under `dir`, as namespace paths (`layout/footer`). */
function namespacesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".json")) {
        out.push(relative(dir, full).split(sep).join("/").replace(/\.json$/, ""));
      }
    }
  };
  walk(dir);
  return out.sort();
}


/** `"use client"`, which has to be the file's first statement to count. */
const CLIENT_DIRECTIVE = /^\s*["']use client["']/m;
/** Every static and dynamic import of a path inside the tree. */
const IMPORT = /(?:from\s+"([^"]+)")|(?:import\(\s*"([^"]+)"\s*\))/g;

/** Every `.ts`/`.tsx` under `src`, except the locale tree itself. */
function appFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (full === localesRoot) continue;
    if (entry.isDirectory()) appFiles(full, out);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
      out.push(full);
  }
  return out;
}

/** Resolve one import specifier to a file in the tree, or null if it leaves it. */
function resolveImport(
  specifier: string,
  from: string,
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

/**
 * The namespaces the browser can actually read, which is what decides whether a
 * namespace crosses the wire at all.
 *
 * Every namespace used to, because the server hands the client provider ONE
 * dictionary set and the provider's loader is synchronous, so anything a reader
 * might ask for has to already be there. Measured on French: 392 namespaces and
 * 263 342 octets inlined in the RSC payload of every page, 59% of a player
 * profile's payload, where a page's own prose is a few kilobytes. Three
 * quarters of it was prose only the SERVER renders: a page's copy read through
 * `getTranslation`, which never needs a browser to hold it.
 *
 * So the test is reachability of the BUNDLE rather than anything about the
 * namespace: a file carrying `"use client"` is an entry point, everything it
 * imports is in the browser with it, and a namespace ships when its name
 * appears as a string literal in one of those files. Measured: 75 namespaces
 * and 70 147 octets leave every page of the site.
 *
 * **Matched on the literal, not on `useTranslation("...")`.** The call is how
 * nearly all of them are read, and it is not how all of them are: the partners
 * page holds its namespace in a `const`, the game vocabulary is a list of names
 * in `lib/game-vocabulary`, and `components/fumadocs` is read by indexing the
 * dictionary set directly in `components/provider`. A rule keyed on the call
 * would have stripped the last one and left the documentation chrome rendering
 * its own keys, in the one place no page of this site renders.
 *
 * It over-includes by construction (a namespace named in a comment, or in a
 * module a client component imports for a type, ships anyway), which is the
 * direction to err in: the cost of a namespace too many is its bytes, and the
 * cost of one too few is a raw key at a reader.
 */
function clientNamespaces(all: readonly string[]): string[] {
  const paths = appFiles(srcRoot);
  const files = new Set(paths);
  const source = new Map(
    paths.map((file) => [file, readFileSync(file, "utf-8")] as const),
  );
  const imports = new Map(
    paths.map((file) => [
      file,
      [...(source.get(file) ?? "").matchAll(IMPORT)]
        .map((match) => resolveImport(match[1] ?? match[2], file, files))
        .filter((target): target is string => target !== null),
    ]),
  );

  const reached = new Set<string>();
  const stack = paths.filter((file) =>
    CLIENT_DIRECTIVE.test(source.get(file) ?? ""),
  );
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (reached.has(file)) continue;
    reached.add(file);
    for (const target of imports.get(file) ?? []) {
      if (!reached.has(target)) stack.push(target);
    }
  }

  const bundle = [...reached].map((file) => source.get(file) ?? "").join("\n");
  return all.filter((namespace) => bundle.includes(JSON.stringify(namespace)));
}

const namespaces = namespacesIn(join(localesRoot, DEFAULT_LOCALE));
const client = clientNamespaces(namespaces);

mkdirSync(outDir, { recursive: true });
// A locale removed from the enum must not leave its module behind: the loader
// map would still be regenerated without it, but the stale file would keep
// importing translation files nothing else references.
for (const entry of readdirSync(outDir)) rmSync(join(outDir, entry));

const HEADER = `// Generated by scripts/generate-locales.ts (postinstall/predev/prebuild).
// Do not edit.`;

for (const locale of LOCALES) {
  // Only what this locale actually carries. A namespace it is missing resolves
  // through the English fallback rather than breaking the build.
  const carried = namespaces.filter((namespace) =>
    existsSync(join(localesRoot, locale, `${namespace}.json`)),
  );
  // One merged file per locale rather than one import per namespace.
  //
  // The shape the app sees is identical: `Dictionaries` is
  // `Partial<Record<Namespace, TranslationDictionary>>`, so the literal type of
  // each file was inferred and then immediately widened away. Nothing ever read
  // it, and computing it 12,240 times (340 namespaces x 36 locales) is what
  // took the build's TypeScript pass to 2.66 GB against its 1536 MB heap, where
  // it died with "Ineffective mark-compacts near heap limit" AFTER compiling
  // successfully. This leaves 36 JSON modules to type instead.
  //
  // Nothing is lost to the bundler either: the dictionaries object references
  // every namespace, so none of them was tree-shakeable before. A locale is
  // loaded whole (`loadDictionaries`), and the namespaces that must not cross
  // the wire are stripped at runtime in `components/document`, not here.
  const merged: Record<string, unknown> = {};
  for (const namespace of carried) {
    merged[namespace] = JSON.parse(
      readFileSync(join(localesRoot, locale, `${namespace}.json`), "utf-8"),
    );
  }
  writeFileSync(
    join(outDir, `${locale}.json`),
    `${JSON.stringify(merged, null, 2)}\n`,
  );

  writeFileSync(
    join(outDir, `${locale}.ts`),
    `${HEADER}
import type { Dictionaries } from ".";
import dictionaries from "./${locale}.json";

export default dictionaries as Dictionaries;
`,
  );
}

// `GAME_NAME_KEYS`: the stat labels that are one of the game's own names, by the
// key `statLabel` slugs them to.
//
// Derived from the English `game/vocabulary` rather than listed by hand, so a
// name Wargaming adds is covered the day it is catalogued and a prose file can
// never quietly take one back. `composeStatLabels` says what reads it and why.
const vocabulary = JSON.parse(
  readFileSync(
    join(localesRoot, DEFAULT_LOCALE, "game", "vocabulary.json"),
    "utf-8",
  ),
) as Record<string, unknown>;
const gameNameKeys = cataloguedLabelKeys(vocabulary, statLabelKey);

writeFileSync(
  join(outDir, "game-names.ts"),
  `${HEADER}

/** A stat label's slugged English -> its \`game/vocabulary\` key. */
export const GAME_NAME_KEYS: Record<string, string> = {
${[...gameNameKeys]
  .map(([slug, key]) => `  ${JSON.stringify(slug)}: ${JSON.stringify(key)},`)
  .join("\n")}
};
`,
);

writeFileSync(
  join(outDir, "client-namespaces.ts"),
  `${HEADER}
import type { Namespace } from ".";

/** The namespaces the browser bundle can read, derived from the import graph by
 * \`clientNamespaces\` in the generator, which says why. \`lib/translations.server\`
 * strips everything else before the dictionaries cross the wire. */
export const CLIENT_NAMESPACES: readonly Namespace[] = [
${client.map((namespace) => `  ${JSON.stringify(namespace)},`).join("\n")}
];
`,
);

const namespaceUnion = namespaces.length
  ? namespaces.map((namespace) => `\n  | ${JSON.stringify(namespace)}`).join("")
  : " never";

const loaders = LOCALES.map(
  (locale) => `  ${JSON.stringify(locale)}: () => import("./${locale}"),`,
).join("\n");

writeFileSync(
  join(outDir, "index.ts"),
  `${HEADER}
import type { TranslationDictionary } from "@onruntime/translations";
import type { Locale } from "@/lib/translations";

/** Every translation file the English source declares, by path from
 * \`src/locales/<locale>/\`. Passing anything else to \`getTranslation\` or
 * \`useTranslation\` is a compile error rather than a key echoed at a reader. */
export type Namespace =${namespaceUnion};

export const NAMESPACES: readonly Namespace[] = [
${namespaces.map((namespace) => `  ${JSON.stringify(namespace)},`).join("\n")}
];

export type Dictionaries = Partial<Record<Namespace, TranslationDictionary>>;

const LOADERS: Record<Locale, () => Promise<{ default: Dictionaries }>> = {
${loaders}
};

/** Everything one locale carries, as one chunk. Awaited once per locale per
 * process by \`lib/translations.server\`, which caches it. */
export function loadDictionaries(locale: Locale): Promise<Dictionaries> {
  return LOADERS[locale]().then((module) => module.default);
}
`,
);

console.log(
  `[locales] ${namespaces.length} namespace(s) x ${LOCALES.length} locale(s), ` +
    `${client.length} reaching the browser, ` +
    `${gameNameKeys.size} catalogued label(s) -> ${relative(webRoot, outDir)}`,
);
