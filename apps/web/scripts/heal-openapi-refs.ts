// Heals dangling `$ref`s in `openapi.generated.json` after `openapi-gen
// generate`. next-openapi-gen resolves a schema reference to its `.meta({ id })`
// name via an alias it fills lazily as it walks each endpoint; when an id'd
// schema is imported from another file and first embedded through a deeper
// nesting (e.g. `changes.api.ts`'s `changedTank.identity` -> `tankIdentity`), the
// alias isn't set yet, so it emits the raw variable name (`tankIdentity`) instead
// of the component id (`TankIdentity`), leaving a `$ref` that points at no
// component. openapi-typescript then fails to bundle the spec ("Can't resolve
// $ref"). This walks the spec and rewrites every ref whose target is missing but
// matches an existing component case-insensitively, so the fix is generic: any
// future schema hitting the same ordering quirk is healed with nothing to
// hand-maintain. Runs in the generation chain right after inject-openapi-enums.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const specPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "services",
  "openapi",
  "openapi.generated.json",
);

const PREFIX = "#/components/schemas/";

const spec = JSON.parse(readFileSync(specPath, "utf8")) as {
  components?: { schemas?: Record<string, unknown> };
};
const schemas = spec.components?.schemas ?? {};
const names = Object.keys(schemas);
// Case-insensitive index of component names. A collision (two components equal
// but for case) would make healing ambiguous, so those names are excluded.
const byLower = new Map<string, string | null>();
for (const name of names) {
  const key = name.toLowerCase();
  byLower.set(key, byLower.has(key) ? null : name);
}

let healed = 0;
const unresolved: string[] = [];

function walk(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item);
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;

  const ref = obj.$ref;
  if (typeof ref === "string" && ref.startsWith(PREFIX)) {
    const target = ref.slice(PREFIX.length);
    if (!(target in schemas)) {
      const match = byLower.get(target.toLowerCase());
      if (match) {
        obj.$ref = PREFIX + match;
        healed += 1;
      } else {
        unresolved.push(target);
      }
    }
  }

  for (const value of Object.values(obj)) walk(value);
}

walk(spec);
writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);

if (unresolved.length > 0) {
  throw new Error(
    `[heal-openapi-refs] ${unresolved.length} $ref(s) point at no component and have no case match: ${[...new Set(unresolved)].join(", ")}`,
  );
}
console.log(`[heal-openapi-refs] healed ${healed} dangling ref(s)`);
