import {
  getMonthlyPledgeCents,
  getSupportersPodium,
  getTotalReceivedCents,
} from "@unicum.gg/core/subscription";
import { getClansPodium } from "@unicum.gg/core/subscription/clan";
import { jsonResponse } from "@/services/openapi/json-response";
import { SupportersPodiumResponse } from "./schema.api";
import { measured } from "@/services/perf";

// Reads live subscription state per-request.
export const dynamic = "force-dynamic";

/**
 * Supporters board
 * @description Everyone who has contributed, ranked by the net total they have given since launch, highest first, so a monthly pledge and a one-off donation are counted alike. Individual amounts are never exposed, only the ranking; anonymous supporters appear as "Anonymous". Beside it, the clans board ranks clans by what their current members have given and counted for them. The aggregate monthly pledge is returned beside it for the funding run-rate.
 * @response SupportersPodiumResponse
 * @tag System
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /support/podium", () => GET__perf(...args));
}
async function GET__perf() {
  const [supporters, clans, monthlyPledgedCents, receivedCents] =
    await Promise.all([
      getSupportersPodium(),
      getClansPodium(),
      getMonthlyPledgeCents(),
      getTotalReceivedCents(),
    ]);
  return jsonResponse(SupportersPodiumResponse, {
    supporters,
    clans,
    monthlyPledgedCents,
    receivedCents,
  });
}
