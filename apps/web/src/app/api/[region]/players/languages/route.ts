import { isRegion } from "@unicum.gg/wargaming";
import { getPlayerLanguageStats } from "@/services/players/available-languages";
import { jsonResponse } from "@/services/openapi/json-response";
import { PlayerLanguagesResponse } from "./schema.api";
import { measured } from "@/services/perf";

/**
 * Player languages
 * @description Languages the region's tracked players speak (inferred from their clan's declared languages), with total and strict (single-language clans) counts. Backs the by-language leaderboards.
 * @pathParams regionParams
 * @response PlayerLanguagesResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/languages", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const results = await getPlayerLanguageStats(region);
  return jsonResponse(PlayerLanguagesResponse, { results });
}
