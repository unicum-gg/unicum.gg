import { readBotUsage } from "@unicum.gg/core/usage/read";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { BotUsageResponse } from "./schema.api";

// A handful of indexed reads over small tables, answered live: the pages that
// show these are prerendered and carry their own window.
export const dynamic = "force-dynamic";

/**
 * Bot usage
 * @description How much the unicum.gg Discord bot is used: the servers it is in, sampled hourly since Discord keeps no history, and the slash commands it answered.
 * @response BotUsageResponse
 * @tag System
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /usage/bot", () => GET__perf(...args));
}
async function GET__perf() {
  return jsonResponse(BotUsageResponse, await readBotUsage(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
