import { getTotalReceivedCents } from "@unicum.gg/core/subscription";
import { fundingProgress } from "@unicum.gg/shared";
import { getExpenseLedger } from "@/services/coverage";
import { jsonResponse } from "@/services/openapi/json-response";
import { FundingSummaryResponse } from "./schema.api";
import { measured } from "@/services/perf";

// Cheap per-request read (one DB sum + a constant-derived cost), so the top-bar
// mini bar can poll it on every page.
export const dynamic = "force-dynamic";

/**
 * Funding progress
 * @description Compact cumulative funding progress: how much of the total spend since launch supporters have covered. Returns the percentage plus the raised and goal amounts in EUR (aggregate only). Powers the top-bar mini funding bar.
 * @response FundingSummaryResponse
 * @tag System
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /support/funding", () => GET__perf(...args));
}
async function GET__perf() {
  // Pledges are collected in EUR and the bills are in EUR, so this whole
  // computation stays in one currency and never converts.
  const receivedEur = (await getTotalReceivedCents()) / 100;
  const { goalEur, pct } = fundingProgress(
    getExpenseLedger(),
    receivedEur,
    Date.now(),
  );
  return jsonResponse(FundingSummaryResponse, { pct, receivedEur, goalEur });
}
