import { readModUsage } from "@unicum.gg/core/usage/read";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { ModUsageResponse } from "./schema.api";

// A handful of indexed reads over small tables, answered live: the pages that
// show these are prerendered and carry their own window.
export const dynamic = "force-dynamic";

/**
 * Mod usage
 * @description How many players run the unicum.gg mod and how many battles it has sent, in total, over the last 30 days and server by server.
 * @response ModUsageResponse
 * @tag System
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /usage/mod", () => GET__perf(...args));
}
async function GET__perf() {
  return jsonResponse(ModUsageResponse, await readModUsage(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
