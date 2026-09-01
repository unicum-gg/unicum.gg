import { isRegion } from "@unicum.gg/wargaming";
import { listTournaments } from "@unicum.gg/core/tournaments/read";
import { jsonResponse } from "@/services/openapi/json-response";
import { TOURNAMENTS_PAGE_SIZE, tournamentsQuery } from "@/services/openapi/schemas";
import { TournamentsListResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

/**
 * Tournaments
 * @description Wargaming's own tournaments on a region, newest first: the nightly gold ladders, the seasonal clan championships, and the whole settled archive back to 2018. Filter by status to separate what can still be entered from what has already been played. Mirrored from the tournament system, which publishes none of this through the public game API.
 * @pathParams regionParams
 * @queryParams tournamentsQuery
 * @response TournamentsListResponse
 * @tag Tournaments
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/tournaments", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const url = new URL(req.url);
  const parsed = tournamentsQuery.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "invalid_query" }, { status: 400 });
  }

  const data = await listTournaments(region, {
    ...parsed.data,
    limit: parsed.data.limit ?? TOURNAMENTS_PAGE_SIZE,
    offset: parsed.data.offset ?? 0,
  });
  return jsonResponse(TournamentsListResponse, data, {
    // The live rows move as teams register, so this is short. The archive
    // behind them never changes, but it shares the page with them.
    headers: { "cache-control": "public, max-age=300" },
  });
}
