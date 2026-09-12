import { isGlossaryCategory } from "@unicum.gg/shared";
import { glossaryLocale, listGlossary, listGlossaryByCategory } from "@/services/glossary";
import { contentLanguage, requestedLanguage } from "@/services/openapi/locale";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { GlossaryListResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Glossary
 * @description Every World of Tanks term the site defines: game mechanics, vehicle statistics, battle formats, rating systems and community slang. Each entry carries a one-sentence definition, the other spellings it is searched by, and the section it belongs to. Alphabetical by term. Pass `category` to read one section.
 * @queryParams glossaryQuery
 * @response GlossaryListResponse
 * @tag Glossary
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /glossary", () => GET__perf(...args));
}
async function GET__perf(req: Request) {
  const category = new URL(req.url).searchParams.get("category");
  if (category !== null && !isGlossaryCategory(category)) {
    return Response.json({ error: "invalid_category" }, { status: 400 });
  }

  const served = glossaryLocale(requestedLanguage(req));
  const results = category
    ? await listGlossaryByCategory(category, served)
    : await listGlossary(served);
  return jsonResponse(
    GlossaryListResponse,
    { results },
    // The catalogue ships with the build, so it only ever changes on a deploy.
    contentLanguage(served, {
      headers: { "cache-control": "public, max-age=3600" },
    }),
  );
}
