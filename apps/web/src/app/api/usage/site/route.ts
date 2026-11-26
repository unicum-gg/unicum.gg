import { readSiteUsage } from "@unicum.gg/core/usage/read";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { SiteUsageResponse } from "./schema.api";

// A handful of indexed reads over small tables, answered live: the pages that
// show these are prerendered and carry their own window.
export const dynamic = "force-dynamic";

/**
 * Site usage
 * @description How many people use unicum.gg, read from our own records rather than from an analytics tool: accounts created, signed-in readers seen today, this week and this month, linked services and active supporters. Only signed-in readers can be counted, so anonymous traffic is not in these figures.
 * @response SiteUsageResponse
 * @tag System
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /usage/site", () => GET__perf(...args));
}
async function GET__perf() {
  return jsonResponse(SiteUsageResponse, await readSiteUsage(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
