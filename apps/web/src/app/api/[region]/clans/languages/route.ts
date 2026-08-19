import { isRegion } from "@unicum.gg/wargaming";
import { getLanguageStats } from "@/services/clans/available-languages";
import { jsonResponse } from "@/services/openapi/json-response";
import { ClanLanguagesResponse } from "./schema.api";
import { measured } from "@/services/perf";

/**
 * Clan languages
 * @description Languages the region's clans declare, with total and strict (single-language) counts. Backs the by-language leaderboards.
 * @pathParams regionParams
 * @response ClanLanguagesResponse
 * @tag Clans
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/clans/languages", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const results = await getLanguageStats(region);
  return jsonResponse(ClanLanguagesResponse, { results });
}
