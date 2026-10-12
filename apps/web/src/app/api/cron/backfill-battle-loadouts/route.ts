import { env } from "env";
import { backfillBattleLoadouts } from "@unicum.gg/core/battles/loadouts";
import { isRegion } from "@unicum.gg/wargaming";

/**
 * Re-read archived recordings and fill in what their rows are missing.
 *
 * **Why this is a route and not just the script beside it.** The archive
 * answers on the deployment's own network, so a sweep run from a laptop fetches
 * nothing: the command-line version is for watching one battle go through, and
 * this is for the history. Both call the same function, so neither can drift
 * into being the one that is subtly wrong.
 *
 * **Why it exists at all.** The insert used to ignore conflicts outright, so a
 * fact collected after a row was written could never reach that row. Field
 * modifications were the first: the vehicles with no row got one, and the one
 * vehicle that HAD a row -- always the player who recorded -- kept its empty
 * column. A battle showed everyone's field modifications except the recorder's
 * own, which is the one person looking at it. The insert now fills nulls
 * without restating anything; this is what walks the rows written before that.
 *
 * One page per call, with a cursor, because each battle is about a megabyte off
 * object storage plus a decryption and an inflate. Loop on `next` until it
 * comes back null:
 *
 *   curl -XPOST -H "authorization: Bearer $CRON_SECRET" \
 *     "$APP/api/cron/backfill-battle-loadouts?region=eu&gaps=1&limit=25"
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

  const result = await backfillBattleLoadouts(region, {
    limit: Number(url.searchParams.get("limit") ?? 0) || 25,
    after: when,
    arenaUniqueId: url.searchParams.get("arena"),
    // The two filters a caller actually wants: the rows with a hole in them,
    // or the battles that have no row at all. Neither, and it sweeps every
    // battle with a recording, which is the slow and complete option.
    gapsOnly: url.searchParams.get("gaps") === "1",
    missingOnly: url.searchParams.get("missing") === "1",
    onFailure: (arenaUniqueId, reason) =>
      console.error(
        `[cron/backfill-battle-loadouts] ${region}/${arenaUniqueId}`,
        reason,
      ),
  });

  return Response.json({
    ...result,
    // ISO rather than a Date, because this is the value the caller hands
    // straight back as `after` on the next call.
    next: result.next?.toISOString() ?? null,
  });
}
