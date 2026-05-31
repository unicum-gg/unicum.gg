import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/services/db";
import { topPlayers } from "@/services/db/schema";
import { getPlayerClansBatch } from "@/services/wargaming/wot/clans";
import { isRegion, type Region } from "@/services/wargaming/wot";
import {
  computeWNX,
  getWNXExpectedValues,
} from "@/services/wargaming/wot/ratings";
import type { TankStats } from "@/services/wargaming/wot/tanks";

export enum TopPlayersPeriod {
  Day = "24h",
  Week = "7d",
  Overall = "overall",
}

const PERIOD_INTERVAL: Record<TopPlayersPeriod, string | null> = {
  [TopPlayersPeriod.Day]: "24 hours",
  [TopPlayersPeriod.Week]: "7 days",
  [TopPlayersPeriod.Overall]: null,
};

const MIN_BATTLES: Record<TopPlayersPeriod, number> = {
  [TopPlayersPeriod.Day]: 20,
  [TopPlayersPeriod.Week]: 140,
  [TopPlayersPeriod.Overall]: 20000,
};

const ENRICH_CANDIDATES = 30;

export type TopPlayerResult = {
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  battles: number;
  wnx: number;
};

type DiffRow = {
  account_id: number;
  nickname: string;
  tank_id: number;
  diff_battles: string | number;
  diff_damage: string | number;
  diff_spotted: string | number;
  diff_frags: string | number;
  diff_assist: string | number;
};

export async function computeTopPlayersByWnx(
  region: Region,
  period: TopPlayersPeriod,
  limit: number,
): Promise<TopPlayerResult[]> {
  const interval = PERIOD_INTERVAL[period];
  const minBattles = MIN_BATTLES[period];

  const rows = (await db.execute(
    interval === null
      ? sql`
        SELECT
          p.account_id, p.nickname, ts.tank_id,
          ts.battles AS diff_battles,
          ts.damage_dealt AS diff_damage,
          ts.spotted AS diff_spotted,
          ts.frags AS diff_frags,
          (ts.radio_assisted_damage + ts.track_assisted_damage) AS diff_assist
        FROM (
          SELECT DISTINCT ON (player_id, tank_id)
            player_id, tank_id, battles, damage_dealt, spotted, frags,
            radio_assisted_damage, track_assisted_damage
          FROM tank_snapshots
          ORDER BY player_id, tank_id, taken_at DESC
        ) ts
        INNER JOIN players p ON p.id = ts.player_id
        WHERE p.region = ${region}
      `
      : sql`
        WITH latest AS (
          SELECT DISTINCT ON (player_id, tank_id)
            player_id, tank_id, battles, damage_dealt, spotted, frags,
            radio_assisted_damage, track_assisted_damage
          FROM tank_snapshots
          ORDER BY player_id, tank_id, taken_at DESC
        ),
        earlier AS (
          SELECT DISTINCT ON (player_id, tank_id)
            player_id, tank_id, battles, damage_dealt, spotted, frags,
            radio_assisted_damage, track_assisted_damage
          FROM tank_snapshots
          WHERE taken_at <= NOW() - ${sql.raw(`INTERVAL '${interval}'`)}
          ORDER BY player_id, tank_id, taken_at DESC
        )
        SELECT
          p.account_id, p.nickname, l.tank_id,
          (l.battles - e.battles) AS diff_battles,
          (l.damage_dealt - e.damage_dealt) AS diff_damage,
          (l.spotted - e.spotted) AS diff_spotted,
          (l.frags - e.frags) AS diff_frags,
          ((l.radio_assisted_damage - e.radio_assisted_damage) + (l.track_assisted_damage - e.track_assisted_damage)) AS diff_assist
        FROM latest l
        INNER JOIN earlier e USING (player_id, tank_id)
        INNER JOIN players p ON p.id = l.player_id
        WHERE p.region = ${region} AND l.battles > e.battles
      `,
  )) as unknown as DiffRow[];

  type Agg = {
    account_id: number;
    nickname: string;
    tanks: TankStats[];
    totalBattles: number;
  };
  const byPlayer = new Map<number, Agg>();
  for (const row of rows) {
    const battles = Number(row.diff_battles);
    if (battles <= 0) continue;
    const accountId = Number(row.account_id);
    let agg = byPlayer.get(accountId);
    if (!agg) {
      agg = {
        account_id: accountId,
        nickname: row.nickname,
        tanks: [],
        totalBattles: 0,
      };
      byPlayer.set(accountId, agg);
    }
    agg.tanks.push({
      tank_id: Number(row.tank_id),
      all: {
        battles,
        wins: 0,
        damage_dealt: Number(row.diff_damage),
        spotted: Number(row.diff_spotted),
        frags: Number(row.diff_frags),
        dropped_capture_points: 0,
        radio_assisted_damage: Number(row.diff_assist),
        track_assisted_damage: 0,
      },
    });
    agg.totalBattles += battles;
  }

  const wnxExpected = await getWNXExpectedValues();
  const ranked: TopPlayerResult[] = [];
  for (const agg of byPlayer.values()) {
    if (agg.totalBattles < minBattles) continue;
    const wnx = computeWNX(agg.tanks, wnxExpected);
    if (wnx === null || !Number.isFinite(wnx)) continue;
    ranked.push({
      account_id: agg.account_id,
      nickname: agg.nickname,
      clan_tag: null,
      clan_color: null,
      battles: agg.totalBattles,
      wnx,
    });
  }

  ranked.sort((a, b) => b.wnx - a.wnx);
  const candidates = ranked.slice(0, ENRICH_CANDIDATES);
  if (candidates.length === 0) return [];

  const clansByAccount = await getPlayerClansBatch(
    region,
    candidates.map((c) => c.account_id),
  );
  for (const c of candidates) {
    const clan = clansByAccount.get(c.account_id);
    if (clan) {
      c.clan_tag = clan.tag;
      c.clan_color = clan.color;
    }
  }

  return candidates.slice(0, limit);
}

export type TopPlayersSnapshot = {
  results: TopPlayerResult[];
  computedAt: Date | null;
};

export async function getTopPlayersByWnx(
  region: Region,
  period: TopPlayersPeriod,
  limit: number,
): Promise<TopPlayersSnapshot> {
  const rows = await db
    .select()
    .from(topPlayers)
    .where(and(eq(topPlayers.region, region), eq(topPlayers.period, period)))
    .orderBy(asc(topPlayers.rank))
    .limit(limit);

  return {
    results: rows.map((r) => ({
      account_id: r.accountId,
      nickname: r.nickname,
      clan_tag: r.clanTag,
      clan_color: r.clanColor,
      battles: r.battles,
      wnx: Number(r.wnx),
    })),
    computedAt: rows[0]?.computedAt ?? null,
  };
}

export async function getTopPlayersByWnxByRegions(
  regions: Region[],
  period: TopPlayersPeriod,
  limit: number,
): Promise<Record<Region, TopPlayersSnapshot>> {
  const rows = await db
    .select()
    .from(topPlayers)
    .where(
      and(
        inArray(topPlayers.region, regions),
        eq(topPlayers.period, period),
        sql`rank <= ${limit}`,
      ),
    )
    .orderBy(asc(topPlayers.region), asc(topPlayers.rank));

  const out = {} as Record<Region, TopPlayersSnapshot>;
  for (const region of regions) {
    out[region] = { results: [], computedAt: null };
  }
  for (const r of rows) {
    if (!isRegion(r.region)) continue;
    const bucket = out[r.region];
    bucket.results.push({
      account_id: r.accountId,
      nickname: r.nickname,
      clan_tag: r.clanTag,
      clan_color: r.clanColor,
      battles: r.battles,
      wnx: Number(r.wnx),
    });
    if (bucket.computedAt === null) bucket.computedAt = r.computedAt;
  }
  return out;
}
