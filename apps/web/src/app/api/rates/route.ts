import { getExchangeRates } from "@unicum.gg/core/finance";
import { BASE_CURRENCY } from "@unicum.gg/shared";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { ExchangeRatesResponse } from "./schema.api";

// Answered from an in-process memo backed by a shared daily Redis entry, so the
// front can ask on every page load without an upstream call.
export const dynamic = "force-dynamic";

/**
 * Exchange rates
 * @description Live EUR-based exchange rates for the currencies the site displays. Our own money figures (funding progress, infrastructure cost) are held in euros and converted at read time, so this is what a client needs to render them in a regional currency. Refreshed once a day; `updatedAt` is null when no live rate is available, in which case amounts should be shown in euros.
 * @response ExchangeRatesResponse
 * @tag System
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /rates", () => GET__perf(...args));
}
async function GET__perf() {
  const rates = await getExchangeRates();
  return jsonResponse(
    ExchangeRatesResponse,
    {
      base: BASE_CURRENCY,
      rates: rates?.rates ?? { [BASE_CURRENCY]: 1 },
      updatedAt: rates ? rates.updatedAt.toISOString() : null,
    },
    // A day-old rate is still the right rate: let the CDN and the browser hold
    // it, and keep serving the stale one while it refreshes behind them.
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
  );
}
