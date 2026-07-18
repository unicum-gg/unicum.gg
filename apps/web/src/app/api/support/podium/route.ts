import {
  getMonthlyPledgeCents,
  getSupportersPodium,
  getTotalReceivedCents,
} from "@unicum.gg/core/subscription";
import { jsonResponse } from "@/services/openapi/json-response";
import { SupportersPodiumResponse } from "./schema.api";

// Reads live subscription state per-request.
export const dynamic = "force-dynamic";

/**
 * Supporters podium
 * @description Active supporters ranked by their current monthly pledge, highest first. The pledge amount is never exposed, only the ranking; anonymous supporters appear as "Anonymous".
 * @response SupportersPodiumResponse
 * @tag System
 * @openapi
 */
export async function GET() {
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
