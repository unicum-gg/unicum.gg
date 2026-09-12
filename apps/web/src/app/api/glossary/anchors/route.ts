import { glossaryLocale, getGlossaryAnchorPayload } from "@/services/glossary";
import { contentLanguage, requestedLanguage } from "@/services/openapi/locale";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { GlossaryAnchorsResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Glossary anchors
 * @description Where each glossary term attaches to the interface: the tank specification columns and the on-screen labels it defines, with the one-sentence definition to show for them. Small by construction (only anchored terms, listed once each), so a client can hold the whole thing and explain a table without another request.
 * @queryParams glossaryTermQuery
 * @response GlossaryAnchorsResponse
 * @tag Glossary
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /glossary/anchors", () => GET__perf(...args));
}
async function GET__perf(req: Request) {
  const served = glossaryLocale(requestedLanguage(req));
  return jsonResponse(
    GlossaryAnchorsResponse,
    await getGlossaryAnchorPayload(served),
    contentLanguage(served, {
      headers: { "cache-control": "public, max-age=3600" },
    }),
  );
}
