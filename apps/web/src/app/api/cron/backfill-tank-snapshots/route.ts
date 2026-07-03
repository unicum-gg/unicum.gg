import { sql } from "drizzle-orm";
import { env } from "env";
import { db } from "@/services/db";
import {
  playerSnapshotsByRegion,
  playersByRegion,
  tankSnapshotsByRegion,
} from "@/services/db/schema";
import { bulkInsertTankSnapshots } from "@/services/players/tanks";
import { getTanksStats } from "@/services/wargaming/wot/tanks";
import { isRegion, type Region } from "@/services/wargaming/wot";

const MIN_MEMBERS = 50;
const CONCURRENCY = 5;
const REQUEST_DELAY_MS = 100;

export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const region = url.searchParams.get("region") ?? "";
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const result = await backfillTankSnapshots(region);
  return Response.json(result);
}

async function backfillTankSnapshots(region: Region): Promise<{
  candidates: number;
  fetched: number;
  inserted: number;
  failed: number;
}> {
  const targets = await selectTargets(region);
  let fetched = 0;
  let inserted = 0;
  let failed = 0;

  const queue = [...targets];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, () => worker()),
  );

  async function worker() {
    while (queue.length > 0) {
      const target = queue.shift();
      if (!target) return;
      try {
        const tanks = await getTanksStats(region, target.accountId);
        fetched += 1;
        if (tanks.length > 0) {
          await bulkInsertTankSnapshots(region, target.playerId, tanks);
          inserted += tanks.length;
        }
      } catch (err) {
        failed += 1;
        console.error(
          `[backfill-tanks] failed for ${target.accountId} (${region}):`,
          err,
        );
      }
      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
    }
  }

  return { candidates: targets.length, fetched, inserted, failed };
}

type Target = { playerId: number; accountId: number };

async function selectTargets(region: Region): Promise<Target[]> {
  const players = playersByRegion[region];
  const playerSnapshots = playerSnapshotsByRegion[region];
  const tankSnapshots = tankSnapshotsByRegion[region];

  const eligibleClans = (await db.execute(sql`
    WITH latest AS (
      SELECT DISTINCT ON (ps.player_id) ps.player_id, ps.clan_id
      FROM ${playerSnapshots} ps
      INNER JOIN ${players} p ON p.id = ps.player_id
      WHERE ps.clan_id IS NOT NULL
      ORDER BY ps.player_id, ps.taken_at DESC, ps.id DESC
    )
    SELECT clan_id, COUNT(*) AS members
    FROM latest
    GROUP BY clan_id
    HAVING COUNT(*) > ${MIN_MEMBERS}
  `)) as unknown as Array<{ clan_id: string | number; members: string | number }>;

  if (eligibleClans.length === 0) return [];

  const clanIds = eligibleClans.map((c) => Number(c.clan_id));

  const candidates = await db.execute(sql`
    WITH latest AS (
      SELECT DISTINCT ON (ps.player_id) ps.player_id, ps.clan_id
      FROM ${playerSnapshots} ps
      INNER JOIN ${players} p ON p.id = ps.player_id
      WHERE ps.clan_id IS NOT NULL
      ORDER BY ps.player_id, ps.taken_at DESC, ps.id DESC
    )
    SELECT DISTINCT p.id AS player_id, p.account_id
    FROM latest l
    INNER JOIN ${players} p ON p.id = l.player_id
    LEFT JOIN ${tankSnapshots} ts ON ts.player_id = l.player_id
    WHERE l.clan_id = ANY(${sql.raw(`ARRAY[${clanIds.join(",")}]::bigint[]`)})
      AND ts.id IS NULL
  `) as unknown as Array<{ player_id: string | number; account_id: string | number }>;

  return candidates.map((c) => ({
    playerId: Number(c.player_id),
    accountId: Number(c.account_id),
  }));
}
