import { searchGlossaryTerms } from "@unicum.gg/shared";
import { glossaryLocale, listGlossary } from "@/services/glossary";
import { contentLanguage, requestedLanguage } from "@/services/openapi/locale";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { glossarySearchQuery } from "../schema.api";
import { GlossarySearchResponse } from "./schema.api";

export const dynamic = "force-dynamic";

const LIMIT = 5;

/**
 * Search the glossary
 * @description Search every term the site defines (minimum 3 characters), by name, by any other spelling it is known by, and failing both by its definition, so a reader who only remembers what a thing does still finds it. Ranks exact names first, then prefixes, then the rest. Region-less: a definition reads the same on every server.
 * @queryParams glossarySearchQuery
 * @response GlossarySearchResponse
 * @tag Glossary
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /glossary/search", () => GET__perf(...args));
}
async function GET__perf(req: Request) {
  const served = glossaryLocale(requestedLanguage(req));
  const parsed = glossarySearchQuery.safeParse({
    q: new URL(req.url).searchParams.get("q")?.trim() ?? "",
  });
  const results = parsed.success
    ? searchGlossaryTerms(await listGlossary(served), parsed.data.q, LIMIT)
    : [];
  return jsonResponse(
    GlossarySearchResponse,
    { results },
    // The catalogue ships with the build, so a query's answer only ever changes
    // on a deploy.
    contentLanguage(served, {
      headers: { "cache-control": "public, max-age=3600" },
    }),
  );
}
