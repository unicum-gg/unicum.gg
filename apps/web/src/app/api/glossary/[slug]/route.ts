import { renderGlossaryTerm } from "@/services/glossary";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { GlossaryTermResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Glossary term
 * @description One glossary term in full: its definition, the body of the entry with every mention of another term already resolved to that term's slug, the terms it relates to, and the pages of the site it points at.
 * @pathParams glossaryParams
 * @response GlossaryTermResponse
 * @tag Glossary
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /glossary/{slug}", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const term = renderGlossaryTerm(slug);
  if (!term) {
    return Response.json({ error: "term_not_found" }, { status: 404 });
  }

  return jsonResponse(GlossaryTermResponse, term, {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
