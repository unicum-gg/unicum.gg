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
 * Supporters board
 * @description Everyone who has contributed, ranked by the net total they have given since launch, highest first, so a monthly pledge and a one-off donation are counted alike. Individual amounts are never exposed, only the ranking; anonymous supporters appear as "Anonymous". The aggregate monthly pledge is returned beside it for the funding run-rate.
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
