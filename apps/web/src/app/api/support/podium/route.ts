import {
  getMonthlyPledgeCents,
  getSupportersPodium,
  getTotalReceivedCents,
} from "@unicum.gg/core/subscription";
import { jsonResponse } from "@/services/openapi/json-response";
import { SupportersPodiumResponse } from "./schema.api";
import { measured } from "@/services/perf";

// Reads live subscription state per-request.
export const dynamic = "force-dynamic";

/**
 * Supporters podium
 * @description Active supporters ranked by their current monthly pledge, highest first. The pledge amount is never exposed, only the ranking; anonymous supporters appear as "Anonymous".
 * @response SupportersPodiumResponse
 * @tag System
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /support/podium", () => GET__perf(...args));
}
async function GET__perf() {
  const [supporters, monthlyPledgedCents, receivedCents] = await Promise.all([
    getSupportersPodium(),
    getMonthlyPledgeCents(),
    getTotalReceivedCents(),
  ]);
  return jsonResponse(SupportersPodiumResponse, {
    supporters,
    monthlyPledgedCents,
    receivedCents,
  });
}
