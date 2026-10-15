import { listExpectedValuesFreshness } from "@unicum.gg/core/wargaming/wot/wn-expected";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { DataSourcesResponse } from "./schema.api";

// One small indexed read, and the whole point is to report the current state,
// so it is answered live rather than prerendered.
export const dynamic = "force-dynamic";

/**
 * Data sources
 * @description When each externally sourced table the site depends on was last read successfully. The WN8 and WNX expected values come from third parties we do not run and are read while rendering any player page, so a failed refresh serves the last table we hold instead of failing the page. This endpoint is what says how far behind that table is, and `fetchedAt` is null when one has never been read at all.
 * @response DataSourcesResponse
 * @tag System
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /sources", () => GET__perf(...args));
}
async function GET__perf() {
  const sources = await listExpectedValuesFreshness();
  return jsonResponse(
    DataSourcesResponse,
    {
      sources: sources.map((s) => ({
        id: s.source,
        origin: new URL(s.origin).host,
        fetchedAt: s.fetchedAt ? s.fetchedAt.toISOString() : null,
        tanks: s.tanks,
      })),
    },
    // Short, because this reports freshness and a cached answer about freshness
    // is the one thing it must not be. A minute keeps a curl loop cheap without
    // letting the figure drift noticeably.
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
