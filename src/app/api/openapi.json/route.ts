import APP from "@/constants/app";
import generated from "@/services/openapi/openapi.generated.json";
import { QUERY_PARAM_DEFAULTS } from "@/services/openapi/schemas";

type Schema = {
  allOf?: Schema[];
  enum?: unknown[];
  default?: unknown;
} & Record<string, unknown>;
type Parameter = { name?: string; example?: unknown; schema?: Schema };
type Operation = { parameters?: Parameter[] };
type OpenApiDoc = {
  paths?: Record<string, Record<string, Operation>>;
  info?: Record<string, unknown>;
  servers?: unknown;
} & Record<string, unknown>;

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
 *   the first enum value (so e.g. `region` prefills `eu`) or drops it.
 * Schema-driven, so no per-param config.
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

        if (parameter.example !== "example") continue;
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

/**
 * Serves the OpenAPI document generated at build time by `next-openapi-gen`.
 * `servers` and `info` are patched at request time so the base URL and version
 * stay correct across dev/preview/prod without re-generating; generated paths
 * are relative to `/api`, so the server URL carries that prefix.
 */
export function GET(): Response {
  const doc = structuredClone(generated) as unknown as OpenApiDoc;
  normalizeParameters(doc);

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
