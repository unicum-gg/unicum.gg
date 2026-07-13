import APP from "@/constants/app";
import generated from "@/services/openapi/openapi.generated.json";
import {
  PARAM_EXAMPLES,
  QUERY_PARAM_DEFAULTS,
} from "@/services/openapi/schemas";

type Schema = {
  allOf?: Schema[];
  enum?: unknown[];
  default?: unknown;
} & Record<string, unknown>;
type Parameter = { name?: string; example?: unknown; schema?: Schema };
type Operation = { parameters?: Parameter[]; tags?: string[] };
type OpenApiDoc = {
  paths?: Record<string, Record<string, Operation>>;
  tags?: { name?: string }[];
  info?: Record<string, unknown>;
  servers?: unknown;
} & Record<string, unknown>;

// Docs sidebar order: main entities first, infrastructure last. Tags absent from
// this list sort after (alphabetical fallback via the stable path order).
const TAG_ORDER = [
  "Players",
  "Clans",
  "Tanks",
  "Streamers",
  "Server",
  "System",
  "MCP",
];

const tagWeight = (name: string): number => (TAG_ORDER.indexOf(name) + 1 || 99);

/** Within-tag endpoint rank: discovery (search) → collections → items, with a
 * fixed order for the per-resource sub-endpoints. */
function pathRank(path: string): number {
  if (path.endsWith("/search")) return 0;
  if (path.endsWith("/search/ndjson")) return 1;
  if (path.endsWith("/top")) return 2;
  if (path.endsWith("/specifications")) return 4;
  if (path.endsWith("/economics")) return 5;
  if (path.endsWith("/marks-of-excellence")) return 6;
  if (path.endsWith("/marks-of-mastery")) return 7;
  if (path.endsWith("/vehicles")) return 8;
  if (path.endsWith("/enqueue")) return 20;
  if (path.endsWith("/sse")) return 21;
  return 3; // base resource (a collection or a single item)
}

/** True when the path addresses a single item (a path param other than region),
 * so items sort after their collection siblings. */
const isItemPath = (path: string): boolean =>
  path.replace("{region}", "").includes("{");

const tagOfPath = (pathItem: Record<string, Operation>): string => {
  for (const op of Object.values(pathItem)) {
    if (op.tags?.[0]) return op.tags[0];
  }
  return "";
};

/**
 * Reorders the tag groups and the endpoints within each group into a logical
 * reading order (next-openapi-gen emits both alphabetically). Pure re-sort of
 * the generated doc; no operation is added or dropped.
 */
function reorderDoc(doc: OpenApiDoc): void {
  if (Array.isArray(doc.tags)) {
    doc.tags.sort((a, b) => tagWeight(a.name ?? "") - tagWeight(b.name ?? ""));
  }
  const paths = doc.paths ?? {};
  const ordered = Object.keys(paths).sort((a, b) => {
    const byTag = tagWeight(tagOfPath(paths[a])) - tagWeight(tagOfPath(paths[b]));
    if (byTag !== 0) return byTag;
    const byItem = Number(isItemPath(a)) - Number(isItemPath(b));
    if (byItem !== 0) return byItem;
    const byRank = pathRank(a) - pathRank(b);
    if (byRank !== 0) return byRank;
    return a.localeCompare(b);
  });
  doc.paths = Object.fromEntries(ordered.map((p) => [p, paths[p]]));
}

/**
 * `.optional()` + `.meta()` on a Zod enum makes next-openapi-gen emit the schema
 * as a single-element `allOf` (`{ allOf: [{ enum, ... }], default }`). Scalar
 * only renders a `<select>` when `enum` sits directly on the parameter schema,
 * so hoist the wrapped members up (without clobbering outer keys like `default`).
 */
function flattenSingleAllOf(schema?: Schema): void {
  if (!schema || !Array.isArray(schema.allOf) || schema.allOf.length !== 1) {
    return;
  }
  const [inner] = schema.allOf;
  delete schema.allOf;
  for (const [key, value] of Object.entries(inner)) {
    if (!(key in schema)) schema[key] = value;
  }
}

/**
 * Normalizes generated parameters for docs UIs:
 * - flattens single-element `allOf` so enums render as selects;
 * - applies the query defaults from `QUERY_PARAM_DEFAULTS` (next-openapi-gen
 *   doesn't serialize `.default()` on enum params), e.g. `metric` -> `wnx`;
 * - replaces next-openapi-gen's literal `example: "example"` placeholder with
 *   the first enum value (so e.g. `region` prefills `eu`), an entry from
 *   `PARAM_EXAMPLES` (so e.g. `tag` prefills `FAME`), or drops it.
 */
function normalizeParameters(doc: OpenApiDoc): void {
  for (const pathItem of Object.values(doc.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      for (const parameter of operation.parameters ?? []) {
        flattenSingleAllOf(parameter.schema);

        const fallback = parameter.name
          ? QUERY_PARAM_DEFAULTS[parameter.name]
          : undefined;
        if (
          fallback !== undefined &&
          parameter.schema &&
          parameter.schema.default === undefined
        ) {
          parameter.schema.default = fallback;
        }

        const named = parameter.name
          ? PARAM_EXAMPLES[parameter.name]
          : undefined;
        const isPlaceholder = parameter.example === "example";
        if (named !== undefined) {
          // Our curated example always wins for these params: next-openapi-gen
          // drops `.meta` examples and emits either the `"example"` placeholder,
          // nothing, or even the param name (e.g. `slug` becomes `"slug"`).
          parameter.example = named;
        } else if (isPlaceholder) {
          const enumValues = parameter.schema?.enum;
          if (Array.isArray(enumValues) && enumValues.length > 0) {
            parameter.example = enumValues[0];
          } else {
            delete parameter.example;
          }
        }
      }
    }
  }
}

/**
 * Serves the OpenAPI document generated at build time by `next-openapi-gen`.
 * `servers` and `info` are patched at request time so the base URL and version
 * stay correct across dev/preview/prod without re-generating; generated paths
 * are relative to `/api`, so the server URL carries that prefix.
 */
export function GET(): Response {
  const doc = structuredClone(generated) as unknown as OpenApiDoc;
  normalizeParameters(doc);
  reorderDoc(doc);

  const out = {
    ...doc,
    info: {
      ...doc.info,
      version: APP.VERSION,
      description: APP.DESCRIPTION,
    },
    servers: [{ url: `${APP.URL}/api` }],
    // Empty security array = all endpoints are public; no OAuth server needed.
    security: [],
  };

  return new Response(JSON.stringify(out), {
    headers: {
      "Content-Type": "application/openapi+json; charset=utf-8",
      // Revalidate every load: the spec is tiny and changes per deploy, and a
      // stale cached copy makes the docs show outdated params.
      "Cache-Control": "no-cache",
    },
  });
}
