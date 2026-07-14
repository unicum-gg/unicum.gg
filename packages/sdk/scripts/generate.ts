import { writeFile } from "node:fs/promises";
import openapiTS, { astToString } from "openapi-typescript";
import ts from "typescript";

// Generate `src/generated/schema.ts` from the served OpenAPI spec. The spec
// carries `format: date-time` on every date field, but openapi-typescript types
// those as `string` by default. We map them to `Date` so the generated types
// match the runtime `reviveDates` step in `unwrap()` (see `src/index.ts`).
const SPEC = process.env.UNICUM_OPENAPI_URL ?? "http://localhost:3000/api/openapi.json";
const OUT = "src/generated/schema.ts";

const DATE = ts.factory.createTypeReferenceNode("Date");
const NULL = ts.factory.createLiteralTypeNode(ts.factory.createNull());

async function main() {
  const ast = await openapiTS(new URL(SPEC), {
    transform(schemaObject) {
      if (schemaObject.format !== "date-time") return undefined;
      // OpenAPI 3.1 encodes nullability as `type: ["string", "null"]`.
      const nullable =
        schemaObject.nullable === true ||
        (Array.isArray(schemaObject.type) && schemaObject.type.includes("null"));
      return nullable ? ts.factory.createUnionTypeNode([DATE, NULL]) : DATE;
    },
  });
  await writeFile(OUT, astToString(ast));
  console.log(`Wrote ${OUT} from ${SPEC}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
