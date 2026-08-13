import { eq, inArray, sql } from "drizzle-orm";
import {
  playerAchievementsByRegion,
  playersByRegion,
  type AchievementSection,
  type PlayerAchievement,
  type PlayerAchievements,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { cachedInRedis } from "@unicum.gg/core/redis";
import { wg } from "@unicum.gg/core/wargaming/client";

// The catalogue is the same 510 rows for every player and only moves on a game
// patch, so it is fetched once a day for the whole fleet rather than on every
// profile view. Two WG calls behind this key (the medals and the section names),
// against one per player for their own counts.
const CATALOG_TTL_S = 24 * 60 * 60;
// A failed WG call falls open to an empty catalogue; keep that only briefly so a
// blip does not blank the tab until tomorrow.
const EMPTY_TTL_S = 5 * 60;

// Cold-path cache, for a player the snapshot pipeline has not written yet.
// Short-lived on purpose: the first hit persists the cabinet to Postgres, so
// this only has to absorb the burst between one page view and that write
// landing, not serve as the source of truth.
const PLAYER_TTL_S = 30 * 60;
// A WG failure returns nothing rather than a wrong empty cabinet; retry soon.
const PLAYER_EMPTY_TTL_S = 60;

/**
 * Whether Wargaming means this catalogue entry to be shown as a medal.
 *
 * The catalogue carries a handful of rows that are not medals a player earns
 * once and displays: the per-vehicle badges (Mastery Badge, Marks of
 * Excellence, which `account/achievements` never reports because they live in
 * `tanks/achievements`, one row per tank) and the ranked-battles points
 * counter. Shown anyway, the cabinet tells a player with marks on 143 tanks
 * that they have never earned one.
 *
 * Two flags in the payload say so, and neither is `type` — that is WG's kind
 * field (single / repeatable / class / custom / series) and it does not
 * separate them: the mastery badge is `class`, but so are 21 perfectly ordinary
 * account medals out of the 46 in that group.
 *
 *  - **`order === -1`** is WG's "no position in the list" sentinel. Exactly two
 *    rows carry it: `markOfMastery` and `honoredRank` ("Rank Points"). Note it
 *    has to be `-1` precisely, not any negative: `dedicationMedal1..4` sit at
 *    -10..-7, which is a real sort position putting them first.
 *  - **no `name_i18n`** means there is no display name at all; the tile would
 *    show a raw id like `marksOnGun`.
 *
 * Together they drop 5 of 510, and none of them appears in a real account's
 * earned map, so nothing a player owns is hidden.
 */
function isDisplayableMedal(m: { name_i18n?: string | null; order?: number }) {
  return Boolean(m.name_i18n) && m.order !== -1;
}

/** The catalogue entry, before a player's count is joined onto it. */
type CatalogEntry = Omit<PlayerAchievement, "count">;

type Catalog = { entries: CatalogEntry[]; sections: Record<string, string> };

// WG serves the medal art over plain http. Left as-is the browser blocks it as
// mixed content on our https origin, and `next/image` refuses it outright (the
// remote pattern for `api.worldoftanks.*` is https-only). The host answers on
// https perfectly well, so upgrade the scheme rather than widen the pattern.
function https(url: string): string {
  return url.startsWith("http://") ? `https://${url.slice(7)}` : url;
}

async function fetchCatalog(region: Region): Promise<Catalog> {
  const api = wg.region(region).api.wot.encyclopedia;
  const [medals, info] = await Promise.all([
    api.achievements(),
    api.info({ fields: ["achievement_sections"] }),
  ]);

  const sectionMeta = info.achievement_sections ?? {};
  const sections: Record<string, string> = {};
  for (const [id, s] of Object.entries(sectionMeta)) sections[id] = s.name;

  const entries: CatalogEntry[] = Object.entries(medals)
    .filter(([, m]) => isDisplayableMedal(m))
    .map(([id, m]) => ({
      id,
      name: m.name_i18n || m.name || id,
      description: m.description ?? "",
      condition: m.condition ?? "",
      image: https(m.image_big ?? m.image ?? ""),
      section: m.section ?? "",
      sectionName: sections[m.section ?? ""] ?? m.section ?? "",
      sectionOrder: m.section_order ?? 0,
      order: m.order ?? 0,
      type: m.type ?? "",
      outdated: m.outdated === true,
      tiers: (m.options ?? []).map((o) => ({
        name: o.name_i18n ?? "",
        image: https(o.image_big ?? o.image ?? ""),
      })),
    }));

  return { entries, sections };
}

/** The medal catalogue for a region, shared across every player, and across
 * the profile's cabinet and one vehicle's Awards. */
export function getCatalog(region: Region): Promise<Catalog> {
  return cachedInRedis<Catalog>(
    `wg:achievements:catalog:${region}`,
    (c) => (c.entries.length > 0 ? CATALOG_TTL_S : EMPTY_TTL_S),
    () =>
      fetchCatalog(region).catch((err) => {
        console.error(`[achievements] catalog fetch failed (${region}):`, err);
        return { entries: [], sections: {} };
      }),
  );
}

/**
 * This account's medal counts.
 *
 * Postgres first: the snapshot pipeline writes the cabinet on the same pass as
 * the player's stats, from a request batched 100 accounts at a time, so the
 * common case is a primary-key lookup and no WG traffic at all.
 *
 * The live fetch is only the cold path — a player the pipeline has not reached
 * yet, or one added since its last sweep. It writes what it finds back, so the
 * page pays it once and the row is there for everyone after. That is what makes
 * the tab work for any tracked nickname instead of showing an empty cabinet
 * until the sweep comes round.
 */
async function getPlayerCounts(
  region: Region,
  playerId: number,
  accountId: number,
): Promise<Record<string, number>> {
  const stored = await getAchievements(region, playerId);
  if (stored) return stored.counts;

  const fetched = await cachedInRedis<Record<string, number>>(
    `player:achievements:${region}:${accountId}`,
    (c) => (Object.keys(c).length > 0 ? PLAYER_TTL_S : PLAYER_EMPTY_TTL_S),
    () =>
      wg
        .region(region)
        .api.wot.accounts.achievements({ accountId })
        .then((r) => r?.achievements ?? {})
        .catch((err) => {
          console.error(`[achievements] account fetch failed (${region}):`, err);
          return {};
        }),
  );

  // Only persist a real answer: an empty map here means WG failed, and writing
  // it would pin an empty cabinet in the table until the pipeline overwrote it.
  if (Object.keys(fetched).length > 0) {
    await recordAchievements(region, playerId, fetched).catch((err) =>
      console.error(`[achievements] backfill write failed (${region}):`, err),
    );
  }
  return fetched;
}

/**
 * Persist one player's medal counts.
 *
 * Called from the snapshot pipeline on the same pass that writes the player's
 * stats, using the batched fetch it already made, so a cabinet costs no WG
 * request of its own.
 *
 * The write is conditional in SQL rather than in JS: an unchanged cabinet
 * (which is most of them, since medals move far slower than battle counters)
 * hits `WHERE counts IS DISTINCT FROM excluded.counts` and does nothing. That
 * keeps the table's dead-tuple churn proportional to real medal wins instead of
 * to how often the pipeline sweeps, on a table with one row per tracked player.
 */
export async function recordAchievements(
  region: Region,
  playerId: number,
  counts: Record<string, number>,
): Promise<void> {
  const table = playerAchievementsByRegion[region];
  const earned = Object.values(counts).filter((n) => n > 0).length;
  await db
    .insert(table)
    .values({ playerId, counts, earned })
    .onConflictDoUpdate({
      target: table.playerId,
      set: {
        counts: sql`excluded.counts`,
        earned: sql`excluded.earned`,
        updatedAt: sql`NOW()`,
      },
      setWhere: sql`${table.counts} IS DISTINCT FROM excluded.counts`,
    });
}

/** Distinct medals this player has earned, 0 when we hold no cabinet for them
 * yet. Reads the denormalised column, so it never touches the jsonb map. */
export async function countEarnedAchievements(
  region: Region,
  playerId: number,
): Promise<number> {
  const table = playerAchievementsByRegion[region];
  const [row] = await db
    .select({ earned: table.earned })
    .from(table)
    .where(eq(table.playerId, playerId))
    .limit(1);
  return row?.earned ?? 0;
}

/** One player's stored medal counts, or null when never recorded. */
export async function getAchievements(
  region: Region,
  playerId: number,
): Promise<{ counts: Record<string, number>; updatedAt: Date } | null> {
  const table = playerAchievementsByRegion[region];
  const [row] = await db
    .select({ counts: table.counts, updatedAt: table.updatedAt })
    .from(table)
    .where(eq(table.playerId, playerId))
    .limit(1);
  return row ?? null;
}

/**
 * How many tracked players hold each medal, for the rarity figure under a tile.
 *
 * One pass over the table with `jsonb_object_keys`, which is why the counts are
 * one map per player rather than a row per (player, medal): the relational
 * shape would make this cheap but would cost ~260M rows to maintain, and this
 * runs on a cron, not on a page view.
 */
export async function countMedalHolders(
  region: Region,
): Promise<Map<string, number>> {
  const table = playerAchievementsByRegion[region];
  const rows = (await db.execute(sql`
    SELECT key AS id, COUNT(*)::int AS holders
    FROM ${table}, jsonb_object_keys(counts) AS key
    GROUP BY key
  `)) as unknown as Array<{ id: string; holders: number }>;
  return new Map(rows.map((r) => [r.id, r.holders]));
}

/** How many players have a stored cabinet, the denominator for rarity. */
export async function countPlayersWithAchievements(
  region: Region,
): Promise<number> {
  const table = playerAchievementsByRegion[region];
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(table);
  return row?.n ?? 0;
}

/** Bulk read for the compare/leaderboard paths. */
export async function getAchievementsForPlayers(
  region: Region,
  playerIds: number[],
): Promise<Map<number, Record<string, number>>> {
  if (playerIds.length === 0) return new Map();
  const table = playerAchievementsByRegion[region];
  const rows = await db
    .select({ playerId: table.playerId, counts: table.counts })
    .from(table)
    .where(inArray(table.playerId, playerIds));
  return new Map(rows.map((r) => [r.playerId, r.counts]));
}

export enum PlayerAchievementsError {
  /** No such nickname in this region's DB. */
  PlayerUnknown = "player_unknown",
}

/**
 * The player's medal cabinet: every catalogue entry with the number of times
 * this player earned it (0 when never).
 *
 * The counts come from Postgres, written by the snapshot pipeline on the pass
 * it already makes for the player's stats (`account/achievements` batches 100
 * per request, the same granularity as the change detector, so the cabinet
 * costs one request per hundred players rather than one per player). A player
 * the sweep has not reached yet falls back to a live fetch that persists what
 * it finds. The catalogue behind it is cached for a day.
 *
 * Ordered the way Wargaming orders it (section, then rank within the section),
 * so the grid reads like the in-game cabinet rather than in an order we made up.
 */
export async function loadPlayerAchievements(
  region: Region,
  nickname: string,
): Promise<PlayerAchievements | PlayerAchievementsError> {
  const players = playersByRegion[region];
  const [row] = await db
    .select({ id: players.id, accountId: players.accountId })
    .from(players)
    .where(eq(players.nickname, nickname))
    .limit(1);
  if (!row) return PlayerAchievementsError.PlayerUnknown;

  const [catalog, counts] = await Promise.all([
    getCatalog(region),
    getPlayerCounts(region, row.id, row.accountId),
  ]);

  return joinCatalog(catalog.entries, counts);
}

/**
 * The catalogue joined with what was earned, in Wargaming's own order, plus the
 * per-section tallies the grid's filter reads.
 *
 * Shared by the profile's cabinet and by one vehicle's, which differ only in
 * where the counts came from: the account for one, `tanks/achievements` for the
 * other. The catalogue, the sort and the sectioning are the same both times.
 */
export function joinCatalog(
  entries: Omit<PlayerAchievement, "count">[],
  counts: Record<string, number>,
): PlayerAchievements {
  const achievements: PlayerAchievement[] = entries
    .map((e) => ({ ...e, count: counts[e.id] ?? 0 }))
    .sort(
      (a, b) =>
        a.sectionOrder - b.sectionOrder ||
        a.order - b.order ||
        a.name.localeCompare(b.name),
    );

  const bySection = new Map<string, AchievementSection>();
  for (const a of achievements) {
    let s = bySection.get(a.section);
    if (!s) {
      s = {
        id: a.section,
        name: a.sectionName,
        order: a.sectionOrder,
        earned: 0,
        total: 0,
      };
      bySection.set(a.section, s);
    }
    s.total += 1;
    if (a.count > 0) s.earned += 1;
  }

  return {
    achievements,
    sections: [...bySection.values()].sort((a, b) => a.order - b.order),
    earned: achievements.filter((a) => a.count > 0).length,
    total: achievements.length,
  };
}
