// Fills the enum values into `openapi.generated.json` after `openapi-gen
// generate`. Enum fields in `services/openapi/schemas.ts` pass a native source
// enum to `z.enum(...)`, which next-openapi-gen cannot read statically, so it
// emits the param/property with an `x-enum-source` marker but no `enum`. This
// walks the spec, replaces each marker with the actual values from the domain
// enum (via `OPENAPI_ENUM_SOURCES`), and drops the marker. The domain enum thus
// stays the single source: a new value there flows into the doc with no literal
// to maintain. Runs in the generation chain right after `openapi-gen generate`.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPENAPI_ENUM_SOURCES,
  type EnumSourceKey,
} from "../src/services/openapi/enum-sources";

const MARKER = "x-enum-source";
const specPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "services",
  "openapi",
  "openapi.generated.json",
);

let injected = 0;

/** Recursively fill every marked schema in place. A marker that names no known
 * source is a hard error (a typo must never leave a param with no options). */
function walk(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item);
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;

  if (MARKER in obj) {
    const key = obj[MARKER] as EnumSourceKey;
    const values = OPENAPI_ENUM_SOURCES[key];
    if (!values) {
      throw new Error(
        `[inject-openapi-enums] unknown ${MARKER} "${String(key)}" — add it to OPENAPI_ENUM_SOURCES`,
      );
    }
    obj.type = "string";
    obj.enum = [...values];
    delete obj[MARKER];
    injected += 1;
  }

  for (const value of Object.values(obj)) walk(value);
}

const spec = JSON.parse(readFileSync(specPath, "utf8"));
walk(spec);
writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`[inject-openapi-enums] filled ${injected} enum(s)`);
