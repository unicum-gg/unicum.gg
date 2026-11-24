import { getPublicSupportersSince } from "@unicum.gg/core/subscription";
import { jsonResponse } from "@/services/openapi/json-response";
import { SupporterTiersResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Supporter seniority
 * @description Every public supporter with the start of their current monthly pledge. The supporter crest turns bronze after 3 months, silver after 6 and gold after 12; this is what it is read from, along with the style each one draws their nickname in. Anonymous supporters are not listed.
 * @response SupporterTiersResponse
 * @tag System
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /support/tiers", () => GET__perf(...args));
}
async function GET__perf() {
  const supporters = await getPublicSupportersSince();
  return jsonResponse(
    SupporterTiersResponse,
    { supporters },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
