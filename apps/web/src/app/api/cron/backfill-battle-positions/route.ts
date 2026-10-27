import { env } from "env";
import { backfillBattlePositions } from "@unicum.gg/core/maps/positions";
import { isRegion } from "@unicum.gg/wargaming";

/**
 * Read the archived recordings into the map's spots and hits.
 *
 * The upload route writes them as each file arrives; this is for the replays
 * archived before it did, and for a re-read after a change to how positions
 * are read (`force=1`, since a battle's rows are rewritten whole).
 *
 * A route rather than a script for the reason the loadout backfill gives: the
 * archive answers on the deployment's own network, and a laptop reaches
 * nothing. One page per call, with a cursor. Loop on `next` until it comes
 * back null:
 *
 *   curl -XPOST -H "authorization: Bearer $CRON_SECRET" \
 *     "$APP/api/cron/backfill-battle-positions?region=eu&limit=25"
 */
export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const region = url.searchParams.get("region") ?? "";
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const after = url.searchParams.get("after");
  const when = after ? new Date(after) : null;
  if (when && Number.isNaN(when.getTime())) {
    return Response.json({ error: "invalid_after" }, { status: 400 });
  }

  const result = await backfillBattlePositions(region, {
    limit: Number(url.searchParams.get("limit") ?? 0) || 25,
    after: when,
    arenaUniqueId: url.searchParams.get("arena"),
    force: url.searchParams.get("force") === "1",
    onFailure: (arenaUniqueId, reason) =>
      console.error(
        `[cron/backfill-battle-positions] ${region}/${arenaUniqueId}`,
        reason,
      ),
  });

  return Response.json({
    ...result,
    next: result.next?.toISOString() ?? null,
  });
}
