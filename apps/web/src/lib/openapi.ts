import { createOpenAPI, type OpenAPIOptions } from "fumadocs-openapi/server";
import generated from "@/services/openapi/openapi.generated.json";
import { normalizeDoc, type OpenApiDoc } from "@/services/openapi/normalize";

// Normalize the generated spec the same way the served `/api/openapi.json` does
// (curated parameter examples like `tag` -> `FAME` instead of the placeholder
// `"example"`, query defaults, and the logical tag + endpoint ordering), then
// hand the in-memory document to fumadocs — so the docs match the public spec.
const doc = structuredClone(generated) as unknown as OpenApiDoc;
normalizeDoc(doc);

// The OpenAPI server for the docs. Consumed at build time by `staticSource()`
// (docs page tree) and by each endpoint page's render, so the docs are
// prerendered static pages.
export const openapi = createOpenAPI({
  input: { unicum: doc } as unknown as OpenAPIOptions["input"],
});
