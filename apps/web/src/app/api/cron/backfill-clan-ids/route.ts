import { sql } from "drizzle-orm";
import { env } from "env";
import { db } from "@unicum.gg/core/db";
import { playerSnapshotsByRegion, playersByRegion } from "@unicum.gg/core/db/schema";
import { getPlayersInfoBatch } from "@unicum.gg/core/wargaming/wot/accounts";
import { isRegion, type Region } from "@unicum.gg/wargaming";

const BATCH_SIZE = 100;

export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const region = url.searchParams.get("region") ?? "";
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const result = await backfillClanIds(region);
  return Response.json(result);
}

async function backfillClanIds(region: Region): Promise<{
  scanned: number;
  withClan: number;
  withoutClan: number;
  updated: number;
}> {
  const players = playersByRegion[region];
  const playerSnapshots = playerSnapshotsByRegion[region];
  const rows = await db
    .select({ id: players.id, accountId: players.accountId })
    .from(players);

  let withClan = 0;
  let withoutClan = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const accountIds = batch.map((r) => r.accountId);
    const infos = await getPlayersInfoBatch(region, accountIds);

    const updates: Array<{ playerId: number; clanId: number }> = [];
    for (const row of batch) {
      const info = infos.get(row.accountId);
      const clanId = info?.clan_id ?? null;
      if (clanId === null) {
        withoutClan += 1;
        continue;
      }
      withClan += 1;
      updates.push({ playerId: row.id, clanId });
    }

    if (updates.length === 0) continue;

    const valuesSql = sql.join(
      updates.map((u) => sql`(${u.playerId}::int, ${u.clanId}::bigint)`),
      sql`, `,
    );

    const res = await db.execute(sql`
      UPDATE ${playerSnapshots} AS ps
      SET clan_id = src.clan_id
      FROM (VALUES ${valuesSql}) AS src(player_id, clan_id)
      WHERE ps.player_id = src.player_id
        AND ps.id = (
          SELECT id FROM ${playerSnapshots}
          WHERE player_id = src.player_id
          ORDER BY taken_at DESC, id DESC
          LIMIT 1
        )
        AND ps.clan_id IS DISTINCT FROM src.clan_id
    `);
    updated += res.count ?? 0;
  }

  return { scanned: rows.length, withClan, withoutClan, updated };
}
