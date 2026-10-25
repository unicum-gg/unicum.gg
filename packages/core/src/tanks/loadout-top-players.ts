import { sql } from "drizzle-orm";
import {
  clansByRegion,
  loadoutPrivacy,
  MIN_BATTLES_TO_RATE,
  WN_RATING_METRICS,
  tankSnapshotsByRegion,
  type LoadoutMode,
  type LoadoutCrewMember,
  type LoadoutShell,
  type TopPlayer,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { resolvePlayerBadges } from "@unicum.gg/core/players/badges";
import {
  battlesCte,
  ratingsOf,
  type RatingContext,
} from "@unicum.gg/core/tanks/loadout-sql";
import {
  fieldModSlots,
  getTankFieldMods,
} from "@unicum.gg/core/wargaming/wot/tanks/field-mods";

/**
 * The best players in this vehicle among those whose battles we hold, and what
 * each of them fits to it.
 *
 * Ranked on their CAREER in the vehicle (the latest snapshot of their record
 * on it), because "the best players with this tank" is a question about the
 * whole record and not about the handful of battles the mod happened to see.
 * The loadout beside them is the one of their latest recorded battle in this
 * mode, never their garage: what they fit now is what they last took into a
 * battle we saw.
 *
 * Every rating metric is computed and the top of each is kept, so the page can
 * follow whichever metric the reader picked without asking again. A player too
 * new to the vehicle to carry a rating (the rating gate's own floor) is left
 * out, and a player who asked not to be shown is excluded here, in the query.
 */

/** How many players each metric's ranking shows. */
const TOP_PLAYER_COUNT = 10;

type CandidateRow = {
  account_id: string | number;
  nickname: string | null;
  clan_tag: string | null;
  clan_color: string | null;
  arena_unique_id: string;
  started_at: string | Date;
  opt_devices: (string | null)[] | null;
  consumables: (string | null)[] | null;
  boosters: (string | null)[] | null;
  field_mods_packed: (string | number)[] | null;
  shells: LoadoutShell[] | null;
  crew: LoadoutCrewMember[] | null;
  directive_slots: string | number;
  battles: string | number;
  wins: string | number;
  damage_dealt: string | number;
  spotted: string | number;
  frags: string | number;
  dropped_capture_points: string | number;
  radio_assisted_damage: string | number;
  track_assisted_damage: string | number;
};

export async function topTankPlayers(
  region: Region,
  tankId: number,
  mode: LoadoutMode,
  context: RatingContext,
): Promise<TopPlayer[]> {
  const clans = clansByRegion[region];
  const snapshots = tankSnapshotsByRegion[region];
  const rows = (await db.execute(sql`
    WITH observed AS (${battlesCte(region, tankId, mode)}),
    -- How many directive slots this vehicle shows in the battles we hold. A
    -- layout with no directive mounted can arrive with its slot list empty
    -- rather than holding a free slot, and every vehicle has at least one.
    slots AS (
      SELECT GREATEST(1, COALESCE(MAX(cardinality(boosters)), 0)) AS directives
      FROM observed
    ),
    latest AS (
      SELECT DISTINCT ON (account_id) *
      FROM observed o
      WHERE o.player_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM ${loadoutPrivacy} lp
          WHERE lp.wargaming_account = ${region} || '-' || o.account_id
            AND lp.hidden
        )
      ORDER BY account_id, started_at DESC
    )
    SELECT
      l.account_id, l.nickname, c.tag AS clan_tag, c.color AS clan_color,
      l.arena_unique_id, l.started_at,
      -- By slot, free ones included, which are SQL nulls inside the arrays.
      -- As JSON, because a raw read of a text array hands a null back as the
      -- text "NULL", which then draws as an item called NULL.
      to_jsonb(l.opt_devices) AS opt_devices,
      to_jsonb(l.consumables) AS consumables,
      to_jsonb(l.boosters) AS boosters,
      l.field_mods_packed, l.shells, l.crew,
      (SELECT directives FROM slots) AS directive_slots,
      s.battles, s.wins, s.damage_dealt, s.spotted, s.frags,
      s.dropped_capture_points, s.radio_assisted_damage, s.track_assisted_damage
    FROM latest l
    LEFT JOIN ${clans} c ON c.id = l.clan_id
    JOIN LATERAL (
      SELECT *
      FROM ${snapshots}
      WHERE player_id = l.player_id AND tank_id = ${tankId}
      ORDER BY taken_at DESC, battles DESC
      LIMIT 1
    ) s ON TRUE
    WHERE s.battles >= ${MIN_BATTLES_TO_RATE}
  `)) as unknown as CandidateRow[];
  if (rows.length === 0) return [];

  const n = (value: string | number | null | undefined) => Number(value ?? 0);
  const rated = rows.map((row) => {
    const battles = n(row.battles);
    return {
      row,
      battles,
      rating: ratingsOf(context, {
        battles,
        wins: n(row.wins),
        damage: n(row.damage_dealt),
        assisted: n(row.radio_assisted_damage) + n(row.track_assisted_damage),
        kills: n(row.frags),
        spotted: n(row.spotted),
        defended: n(row.dropped_capture_points),
      }),
    };
  });

  // The top of every WN metric, together: the page picks the metric (a
  // vehicle has no PR or WTR, see `RatingMetric`).
  const kept = new Set<(typeof rated)[number]>();
  for (const metric of WN_RATING_METRICS) {
    [...rated]
      .filter((entry) => entry.rating[metric] != null)
      .sort((a, b) => b.rating[metric]! - a.rating[metric]!)
      .slice(0, TOP_PLAYER_COUNT)
      .forEach((entry) => kept.add(entry));
  }
  const top = [...kept];

  const [badges, fieldMods] = await Promise.all([
    resolvePlayerBadges(
      region,
      top.map(({ row }) => Number(row.account_id)),
    ),
    Promise.all(
      top.map(({ row }) =>
        row.field_mods_packed?.length
          ? fieldModSlots(region, tankId, row.field_mods_packed.map(Number)).catch(() => [])
          : Promise.resolve(null),
      ),
    ),
  ]);
  // The tree's own slots, for a player who has taken no modification at all:
  // drawn empty rather than left out, so the row says "none of seven".
  const tree = fieldMods.some((slots) => slots === null)
    ? await getTankFieldMods(region, tankId).catch(() => null)
    : null;
  const emptyTree: (string | null)[] = (tree?.steps ?? [])
    .filter((step) => step.pair)
    .map(() => null);
  // Every slot, a free one as null: a free slot is part of the build, and
  // drawn as one rather than left out.
  const slots = (keys: (string | null)[] | null) => keys ?? [];
  const padded = (keys: (string | null)[], length: number) =>
    keys.length >= length
      ? keys
      : [...keys, ...Array.from({ length: length - keys.length }, () => null)];

  return top.map(({ row, battles, rating }, index) => {
    const accountId = Number(row.account_id);
    const badge = badges.get(accountId);
    return {
      nickname: row.nickname ?? String(accountId),
      accountId,
      clanTag: row.clan_tag,
      clanColor: row.clan_color,
      isVerified: badge?.verified ?? false,
      isSupporter: badge?.supporter ?? false,
      twitchLogin: badge?.twitchLogin ?? null,
      tournamentWins: badge?.tournamentWins ?? 0,
      tournamentFeaturedWins: badge?.tournamentFeaturedWins ?? 0,
      tournamentBestTitle: badge?.tournamentBestTitle ?? null,
      onslaughtBestTier: badge?.onslaughtBestTier ?? null,
      onslaughtBestRank: badge?.onslaughtBestRank ?? null,
      onslaughtSeasons: badge?.onslaughtSeasons ?? 0,
      battles,
      winrate: battles > 0 ? n(row.wins) / battles : null,
      avgDamage: battles > 0 ? n(row.damage_dealt) / battles : null,
      rating,
      loadoutBattle: {
        arenaUniqueId: row.arena_unique_id,
        startedAt: new Date(row.started_at),
      },
      equipment: slots(row.opt_devices),
      directives: padded(slots(row.boosters), Number(row.directive_slots)),
      consumables: slots(row.consumables),
      fieldMods:
        fieldMods[index]?.map((slot) => (slot.taken && slot.key ? slot.key : null)) ??
        emptyTree,
      crew: (row.crew ?? []).map((member) => ({
        role: member.role,
        skills: member.skills,
      })),
      shells: (row.shells ?? []).map((shell) => ({
        name: shell.name,
        type: shell.type,
        premium: shell.premium,
        count: shell.count,
      })),
    } satisfies TopPlayer;
  });
}
