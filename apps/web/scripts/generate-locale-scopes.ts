// Generates `src/locales/generated/scopes.ts`: the namespaces the chrome reads,
// and what each route adds to them.
//
// Every namespace used to cross the wire on every page, because the client
// provider is handed ONE dictionary set and the library's loader is synchronous:
// there is no asking for a namespace later. `generate-locales` already cut that
// to what the browser bundle can read AT ALL (`CLIENT_NAMESPACES`, 263,342 to
// 193,196 octets of French). This cuts it to what the page in front of the
// reader can read, which is 43,319 octets on average and 90,745 on the heaviest,
// because a namespace belongs to one section and the catalogue was being carried
// by all of them.
//
// The chrome is what every page of a tree shares, so it stays in the root
// layout's provider. Everything else is scoped by the route that reads it, and
// the scopes nest: `components/dictionary-scope` composes its loader over the
// one above, so a tab under a scoped layout reads the chrome, the layout's set
// and its own.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { SERVER_ONLY_NAMESPACES } from "../src/lib/translations";
import { moduleGraph } from "./module-graph";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(webRoot, "src");
const appRoot = join(srcRoot, "app");
const localesRoot = join(srcRoot, "locales");
const outFile = join(localesRoot, "generated", "scopes.ts");

/** The router files that are not a page and not a layout. None of them renders
 * inside a page, so what they read belongs to the chrome: an `error.tsx` has to
 * be a client component, so it cannot resolve a scope of its own, and a route's
 * `not-found.tsx` renders where its page did not. */
const BOUNDARIES = [
  "not-found.tsx",
  "error.tsx",
  "global-error.tsx",
  "template.tsx",
  "default.tsx",
];

const graph = moduleGraph(srcRoot, [localesRoot]);
/** Everything in the browser bundle: a file carrying the directive is an entry
 * point and what it imports is there with it. A namespace read outside this set
 * is read by the server, which holds the whole catalogue either way. */
const inBundle = graph.closure(graph.files.filter(graph.isClient));

const routeFile = (name: string) =>
  graph.files.filter(
    (file) => file.startsWith(appRoot + sep) && file.endsWith(sep + name),
  );

const pages = routeFile("page.tsx");
const layouts = routeFile("layout.tsx");
const boundaries = BOUNDARIES.flatMap(routeFile);

/** The route a file serves, as its own folder under `src/app`. */
const routeOf = (file: string) =>
  relative(appRoot, dirname(file)).split(sep).join("/");

const pagesUnder = (dir: string) =>
  pages.filter((page) => page.startsWith(dir + sep)).length;

/**
 * Which layouts are the chrome, derived rather than listed.
 *
 * `app/` holds two trees, because it holds two kinds of page: the site under
 * `app/[locale]`, and `/docs`, which is generated from the OpenAPI document and
 * exists in one language. A layout is the chrome when it wraps every page of
 * its own tree, and carries a scope when it wraps only part of it. Measured,
 * that line is worth drawing: folding the two `(detail)` layouts into the
 * chrome takes it from 33,014 octets to 69,991, so every page of the site would
 * be carrying the tank and map tab chrome.
 */
const trees = [...new Set(pages.map((page) => relative(appRoot, page).split(sep)[0]))];
const treeSize = new Map(trees.map((tree) => [tree, pagesUnder(join(appRoot, tree))]));
const isChromeLayout = (layout: string) => {
  const dir = dirname(layout);
  if (dir === appRoot) return true;
  const tree = relative(appRoot, layout).split(sep)[0];
  return pagesUnder(dir) === treeSize.get(tree);
};

const chromeRoots = [...layouts.filter(isChromeLayout), ...boundaries];
const scoped = [
  ...layouts.filter((layout) => !isChromeLayout(layout)),
  ...pages,
].sort();

/**
 * Every namespace the English source declares, less the ones that must never
 * cross whatever the code does.
 *
 * Subtracting the deny list here rather than leaving it to the read path is
 * what keeps the generated lists honest, and it is not theoretical: those seven
 * names are string literals in the declaration of `SERVER_ONLY_NAMESPACES`
 * itself, which lives in a module client components import for `Locale`, so the
 * rule below sees all seven in the chrome and they are 98 KB of the heaviest
 * prose on the site.
 */
const namespaces = Object.keys(
  JSON.parse(
    readFileSync(join(localesRoot, "generated", "en.json"), "utf-8"),
  ) as Record<string, unknown>,
).filter((namespace) => !SERVER_ONLY_NAMESPACES.includes(namespace));

/**
 * The namespaces a tree reads in the BROWSER.
 *
 * Matched on the namespace's name appearing as a string literal, not on
 * `useTranslation("...")`, for the reason `generate-locales` gives: several are
 * read another way (a `const`, a list of names, indexing the dictionary set
 * directly), and a rule keyed on the call strips those silently.
 */
function namesIn(roots: readonly string[]): Set<string> {
  const text = [...graph.closure(roots)]
    .filter((file) => inBundle.has(file))
    .map((file) => graph.source.get(file) ?? "")
    .join("\n");
  return new Set(namespaces.filter((ns) => text.includes(JSON.stringify(ns))));
}

const chrome = namesIn(chromeRoots);

/** A scoped layout's set is already on the reader, so its pages must not repeat
 * it. Walked outwards from the file, which is the order the providers nest in. */
const scopedLayoutsAbove = (file: string) =>
  layouts.filter(
    (layout) =>
      layout !== file &&
      !isChromeLayout(layout) &&
      file.startsWith(dirname(layout) + sep),
  );

const key = (file: string) =>
  file.endsWith(`${sep}layout.tsx`) ? `${routeOf(file)}/layout` : routeOf(file);

const scopes = new Map<string, string[]>();
for (const file of scoped) {
  const own = namesIn([file]);
  const inherited = new Set([
    ...chrome,
    ...scopedLayoutsAbove(file).flatMap((layout) => [...namesIn([layout])]),
  ]);
  scopes.set(
    key(file),
    [...own].filter((ns) => !inherited.has(ns)).sort(),
  );
}

const HEADER = `// Generated by scripts/generate-locale-scopes.ts (postinstall/predev/prebuild).
// Do not edit.`;

const union = (values: readonly string[]) =>
  values.length
    ? values.map((value) => `\n  | ${JSON.stringify(value)}`).join("")
    : " never";

const list = (values: readonly string[]) =>
  values.map((value) => `  ${JSON.stringify(value)},`).join("\n");

writeFileSync(
  outFile,
  `${HEADER}
import type { Namespace } from ".";

/** What every page carries: the layouts above it, and the boundaries that render
 * where it did not. Handed to the client provider by \`components/document\`. */
export const CHROME_NAMESPACES: readonly Namespace[] = [
${list([...chrome].sort())}
];

/** Every route that carries a scope of its own, by its folder under
 * \`src/app\` (a layout's key ends in \`/layout\`, since a layout and a page
 * share a folder). Naming one that does not exist is a compile error. */
export type RouteScope =${union([...scopes.keys()].sort())};

/** What each route adds to what it already inherits, so nothing crosses the
 * wire twice. */
export const ROUTE_NAMESPACES: Record<RouteScope, readonly Namespace[]> = {
${[...scopes.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(
    ([route, list]) =>
      `  ${JSON.stringify(route)}: [${list.map((ns) => JSON.stringify(ns)).join(", ")}],`,
  )
  .join("\n")}
};
`,
);

const fr = JSON.parse(
  readFileSync(join(localesRoot, "generated", "fr.json"), "utf-8"),
) as Record<string, unknown>;
const weigh = (keys: readonly string[]) =>
  Buffer.byteLength(
    JSON.stringify(
      Object.fromEntries(keys.filter((k) => k in fr).map((k) => [k, fr[k]])),
    ),
    "utf-8",
  );
/** What a reader actually receives on a page: the chrome, the page's own set,
 * and the sets of any scoped layouts it sits under, which is the figure to
 * report rather than the page's own entry. */
const delivered = pages.map((page) => {
  const ns = new Set([
    ...chrome,
    ...(scopes.get(key(page)) ?? []),
    ...scopedLayoutsAbove(page).flatMap((layout) => scopes.get(key(layout)) ?? []),
  ]);
  return weigh([...ns]);
});
const average = Math.round(
  delivered.reduce((a, b) => a + b, 0) / Math.max(1, delivered.length),
);

console.log(
  `[locale-scopes] chrome ${chrome.size} namespace(s) / ${weigh([...chrome])} o, ` +
    `${scopes.size} route(s), ${average} o per page on average, ` +
    `${Math.max(...delivered)} o at worst -> ${relative(webRoot, outFile)}`,
);
