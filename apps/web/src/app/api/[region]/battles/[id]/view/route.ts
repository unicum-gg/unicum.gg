import { isRegion } from "@unicum.gg/wargaming";
import { normaliseBattleId } from "@unicum.gg/core/battles/ingest";
import { countReplayView } from "@unicum.gg/core/battles/replays";
import { consumeQuota } from "@unicum.gg/core/lib/request-quota";
import { jsonResponse } from "@/services/openapi/json-response";
import { BattleViewBody, BattleViewResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/** One count per address per recording per hour, so a reload is not a view. */
const VIEW_QUOTA = { limit: 1, windowSeconds: 3600 };

/**
 * Count a replay view
 * @description Record that a reader opened one recording of a battle, which the page shows beside its download count. Sent by the page itself once it is on screen, so a crawler or a link preview that never runs it is not counted, and counted once an hour per address. Always answers `ok`: a view that was not counted is not an error.
 * @pathParams battleParams
 * @body BattleViewBody
 * @response BattleViewResponse
 * @tag Players
 * @openapi
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ region: string; id: string }> },
) {
  const { region, id } = await params;
  if (!isRegion(region) || !/^[0-9]{1,20}$/.test(id)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const parsed = BattleViewBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const address =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const battleId = normaliseBattleId(id);
  const quota = await consumeQuota(
    `replay-view:${region}:${battleId}:${parsed.data.recorder}:${address}`,
    VIEW_QUOTA,
    1,
  ).catch(() => ({ allowed: false }));
  if (quota.allowed) {
    await countReplayView(region, battleId, parsed.data.recorder).catch(() => {});
  }
  return jsonResponse(BattleViewResponse, { ok: true }, { headers: { "cache-control": "no-store" } });
}
