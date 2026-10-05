import { isRegion } from "@unicum.gg/wargaming";
import { battleDetail } from "@unicum.gg/core/battles/read";
import { normaliseBattleId } from "@unicum.gg/core/battles/ingest";
import { jsonResponse } from "@/services/openapi/json-response";
import { BattleDetailResponse } from "./schema.api";
import { measured } from "@/services/perf";

/**
 * Battle
 * @description One whole battle: every vehicle on both teams, each one named where this site holds the account and each one rated on this battle alone against its own vehicle's expected values. Wargaming publishes nothing about a single battle, so a battle exists here only because somebody who was in it shared it through the unicum.gg mod. 404 when we hold no such battle.
 * @pathParams battleParams
 * @response BattleDetailResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/battles/{id}", () => GET__perf(...args));
}
async function GET__perf(
  _req: Request,
  { params }: { params: Promise<{ region: string; id: string }> },
) {
  const { region, id } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  if (!/^[0-9]{1,20}$/.test(id)) {
    return Response.json({ error: "invalid_battle" }, { status: 400 });
  }

  try {
    const battle = await battleDetail(region, normaliseBattleId(id));
    if (!battle) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    // A battle never changes once it has been played, so this is as cacheable
    // as anything on the site. `s-maxage` rather than `max-age`: the shared
    // cache keeps it for an hour, and a reader's own browser revalidates, so a
    // change to what this endpoint answers reaches them on their next visit
    // instead of an hour later. The only thing that moves is `reporters`, when
    // a second client reports the same battle.
    return jsonResponse(
      BattleDetailResponse,
      { ...battle, startedAt: battle.startedAt.toISOString() },
      {
        headers: {
          "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (err) {
    console.error(`[api/${region}/battles/${id}] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
