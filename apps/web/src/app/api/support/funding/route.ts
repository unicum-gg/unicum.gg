import { getTotalReceivedCents } from "@unicum.gg/core/subscription";
import { getMonthlyInfraCostUsd } from "@/services/coverage";
import { fundingProgress, USD_PER_EUR } from "@/lib/funding";
import { jsonResponse } from "@/services/openapi/json-response";
import { FundingSummaryResponse } from "./schema.api";

// Cheap per-request read (one DB sum + a constant-derived cost), so the top-bar
// mini bar can poll it on every page.
export const dynamic = "force-dynamic";

/**
 * Funding progress
 * @description Compact cumulative funding progress: how much of the total infrastructure spend since launch supporters have covered. Returns the percentage plus the raised and goal amounts in USD (aggregate only). Powers the top-bar mini funding bar.
 * @response FundingSummaryResponse
 * @tag System
 * @openapi
 */
export async function GET() {
  const monthlyCostUsd = getMonthlyInfraCostUsd();
  const receivedCents = await getTotalReceivedCents();
  const receivedUsd = (receivedCents / 100) * USD_PER_EUR;
  const { goalUsd, pct } = fundingProgress(monthlyCostUsd, receivedUsd, Date.now());
  return jsonResponse(FundingSummaryResponse, { pct, receivedUsd, goalUsd });
}
