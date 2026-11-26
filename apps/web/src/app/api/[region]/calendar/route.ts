import { isRegion } from "@unicum.gg/wargaming";
import { readPortalCalendar } from "@unicum.gg/core/portal-events";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { CalendarResponse } from "./schema.api";

/**
 * Official calendar
 * @description Every entry of the region's official World of Tanks calendar (the "This week's highlights" widget of the portal home page): events, Battle Pass seasons, updates, specials. Wargaming shows the current week only and keeps nothing, so this is our own record of it, captured hourly, going back to `recordedSince`. Dates are ISO 8601 strings.
 * @pathParams regionParams
 * @response CalendarResponse
 * @openapi
 * @tag Calendar
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/calendar", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  return jsonResponse(CalendarResponse, await readPortalCalendar(region), {
    // The capture writes once an hour, so ten minutes is fresh enough for any
    // caller and costs the database nothing.
    headers: { "cache-control": "public, max-age=600" },
  });
}
