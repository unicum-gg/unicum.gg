import APP from "@/constants/app";
import generated from "@/services/openapi/openapi.generated.json";
import { normalizeDoc, type OpenApiDoc } from "@/services/openapi/normalize";

/**
 * Serves the OpenAPI document generated at build time by `next-openapi-gen`.
 * `servers` and `info` are patched at request time so the base URL and version
 * stay correct across dev/preview/prod without re-generating; generated paths
 * are relative to `/api`, so the server URL carries that prefix. Parameter
 * examples/defaults + tag ordering are normalized by the shared `normalizeDoc`
 * (see `services/openapi/normalize.ts`), which the fumadocs docs source uses too.
 */
export function GET(): Response {
  const doc = structuredClone(generated) as unknown as OpenApiDoc;
  normalizeDoc(doc);

  const out = {
    ...doc,
    info: {
      ...doc.info,
      version: APP.VERSION,
      description: APP.DESCRIPTION,
    },
    // `servers` is set by `normalizeDoc` (shared with the fumadocs docs).
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
