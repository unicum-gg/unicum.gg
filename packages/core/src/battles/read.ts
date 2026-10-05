import { desc, eq, inArray, sql } from "drizzle-orm";
import type { Region } from "@unicum.gg/wargaming";
import {
  battlesByRegion,
  clansByRegion,
  playersByRegion,
  RatingMetric,
  type BattleEconomy,
  wn7AccAdd,
  wn7AccZero,
  wn7Finalize,
  wn8AccAdd,
  wn8AccZero,
  wn8Finalize,
  wnxAccAdd,
  wnxAccZero,
  wnxFinalize,
  type BattleVehicle,
  type TankStats,
  type VehicleMeta,
  type WN8Expected,
  type WNXExpected,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import { getTankSlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { minimapsByArena } from "@unicum.gg/core/wargaming/wot/maps";
import { resolvePlayerBadges } from "@unicum.gg/core/players/badges";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";

/**
 * Reading back the battles players' own clients reported.
 *
 * Wargaming's API publishes an account's running totals and nothing about a
 * single battle, so everything here exists only because somebody running the
 * mod was in it (see `./ingest`). There is no other source to reconcile
 * against and no way to fill a gap: a player's history starts the day someone
 * in their battles started sharing.
 *
 * **A battle is kept whole and read one player at a time.** The row carries
 * all thirty vehicles in `vehicles`, and this asks only for the one that
 * belongs to the account being looked at. That is the shape the table was
 * chosen for: "which battles was this account in" is an index probe on
 * `player_ids`, and pulling one vehicle out of the row costs nothing more
 * than reading the row.
 */

/** How many battles a player page asks for. */
export const RECENT_BATTLES = 10;

/** The most a caller may ask for in one go. */
export const MAX_RECENT_BATTLES = 50;

/** One battle as a single player's own line through it. */
export type PlayerBattle = {
  /** The game's own battle id, as text. See the schema for why not a number. */
  id: string;
  /** When the battle started, which is the battle's own clock, not ours. */
  startedAt: Date;
  /** `45_north_america`, the arena's name rather than its display title. */
  map: string;
  /**
   * The minimap this arena is actually played on.
   *
   * Resolved against the maps catalogue rather than built from the id: an
   * Onslaught night arena ships a daylight image under its own name and the
   * real one under `<id>_comp7`, and only the arena's own declaration says
   * which. Null for an arena the catalogue does not carry, and the reader
   * falls back to the id-derived one.
   */
  mapImage: string | null;
  /**
   * The arena's extent in metres, which is what places a replay's coordinates
   * on that image. Null for an arena whose definition carries no box, and the
   * viewer then has nothing to project onto.
   */
  mapBounds: {
    bottomLeft: { x: number; z: number };
    upperRight: { x: number; z: number };
  } | null;
  /** `ctf`, `domination`… null when the client did not name one. */
  gameplay: string | null;
  /** The game's own `bonusType`: 1 random, 43 onslaught, 20/21 skirmishes. */
  battleType: number;
  /** Seconds. */
  duration: number | null;
  /** The player's own team, so the outcome below can be read. */
  team: number;
  /** `win`, `loss` or `draw`, worked out from the winning team. */
  outcome: BattleOutcome;
  /**
   * The vehicle they brought, named.
   *
   * Resolved here rather than left as an id, because a row showing `16897`
   * would make the page resolve it, and the catalogue that answers that is a
   * server-side cache of 1269 vehicles. Null for a vehicle the catalogue does
   * not carry, which is what an unreleased or withdrawn one looks like: the
   * row still has a battle worth showing.
   */
  tank: BattleTank | null;
  /** Their own line: damage, assists, and the rest, exactly as stored. */
  own: BattleVehicle;
  /**
   * What this one battle scored, per metric.
   *
   * The same accumulators the profile's lifetime figures are built from, fed a
   * single battle instead of a career: the ratings are defined per battle and
   * only ever averaged, so this is the metric at its own grain rather than a
   * new formula. It is also the one number that says whether a row was any
   * good, which is most of the reason to read the list at all.
   *
   * Null per metric when the vehicle has no expected values, which is what a
   * brand new or withdrawn vehicle looks like.
   */
  rating: Partial<Record<RatingMetric, number | null>>;
  /** How many accounts the battle named, bots excluded. */
  players: number;
  /**
   * How many of our players reported it.
   *
   * Two means two clients of ours were in the same battle, which is the thing
   * the whole design is built to make happen. Shown because it is also the
   * honest answer to "where did this come from".
   */
  reporters: number;
  /**
   * What the battle earned, when it was THIS account that reported it.
   *
   * Null otherwise, and that is not a gap to fill later: the results carry an
   * economy for the reporting client alone, so a battle somebody else uploaded
   * has none for this player at any price. The page shows the detailed report
   * only where this is present, which is the only place it would mean
   * anything.
   */
  personal: BattleEconomy | null;
};

/** A vehicle as a battle row needs it: enough to draw and to link. */
export type BattleTank = {
  /** `typeCompDescr`, which is the catalogue's own tank id. */
  id: number;
  name: string;
  shortName: string;
  tier: number;
  type: string;
  nation: string;
  /** The client's own tag, which the icon is addressed by. */
  tag: string;
  /** Our slug, so the row can link to the vehicle. Null when it has none. */
  slug: string | null;
};

export enum BattleOutcome {
  Win = "win",
  Loss = "loss",
  Draw = "draw",
  /** The results named no winner, which some modes do. */
  Unknown = "unknown",
}

function outcomeOf(team: number, winner: number | null): BattleOutcome {
  if (winner === null) return BattleOutcome.Unknown;
  if (winner === 0) return BattleOutcome.Draw;
  return winner === team ? BattleOutcome.Win : BattleOutcome.Loss;
}

/**
 * This account's most recent battles, newest first.
 *
 * `player_ids @> ARRAY[id]` is the GIN index's own operator, and `started_at`
 * orders and bounds the scan, so this reads the newest partitions and stops.
 * The vehicle is picked out in SQL rather than by filtering a thirty-element
 * array in JavaScript: the row is already being read, and shipping twenty-nine
 * other players' numbers to the page to throw them away would make every
 * response ten times its useful size.
 */
export async function recentBattlesOf(
  region: Region,
  accountId: number,
  limit: number = RECENT_BATTLES,
): Promise<PlayerBattle[]> {
  const table = battlesByRegion[region];
  const wanted = Math.min(Math.max(1, Math.trunc(limit)), MAX_RECENT_BATTLES);
  const rows = await db
    .select({
      id: table.arenaUniqueId,
      startedAt: table.startedAt,
      map: table.mapName,
      gameplay: table.gameplayId,
      battleType: table.battleType,
      duration: table.duration,
      winnerTeam: table.winnerTeam,
      players: sql<number>`coalesce(array_length(${table.playerIds}, 1), 0)::int`,
      reporters: sql<number>`coalesce(array_length(${table.reportedBy}, 1), 0)::int`,
      // The economy belongs to whoever created the row, which `reported_by[1]`
      // names (Postgres arrays count from one). Asked for in SQL rather than
      // filtered in JavaScript so another player's figures never leave the
      // database in the first place.
      personal: sql<BattleEconomy | null>`CASE WHEN ${table.reportedBy}[1] = ${accountId}
                                               THEN ${table.personal} END`,
      // The one vehicle this account brought. `->0` because an account fields
      // exactly one vehicle in a battle, and a filter that found none would
      // mean the row's `player_ids` disagreed with its `vehicles`, which the
      // endpoint derives one from the other precisely to prevent.
      own: sql<BattleVehicle | null>`(
        SELECT v FROM jsonb_array_elements(${table.vehicles}) AS v
        WHERE (v->>'account')::bigint = ${accountId}
        LIMIT 1
      )`,
    })
    .from(table)
    .where(sql`${table.playerIds} @> ARRAY[${accountId}]::bigint[]`)
    .orderBy(desc(table.startedAt))
    .limit(wanted);

  // One catalogue read for the whole page, from a cache that is already warm
  // in any process that has drawn a vehicle. The expected values are global,
  // not per region, and cached the same way.
  if (rows.length === 0) return [];
  const [book, wn8Expected, wnxExpected, minimaps] = await Promise.all([
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
    minimapsByArena(region),
  ]);
  const slugs = new Map<number, string | null>();
  for (const id of new Set(
    rows.map((row) => row.own?.tank).filter((id): id is number => Boolean(id)),
  )) {
    slugs.set(id, await getTankSlug(region, id));
  }

  const out: PlayerBattle[] = [];
  for (const row of rows) {
    // No line for this account in a battle that names it. Not expected, and
    // not worth a half-drawn row on somebody's page: skipped, and said out
    // loud so it is findable rather than silently absent.
    if (!row.own) {
      console.warn(
        `[battles] ${region}: battle ${row.id} lists account ${accountId} but carries no vehicle for it`,
      );
      continue;
    }
    out.push({
      id: row.id,
      startedAt: row.startedAt,
      map: row.map,
      mapImage: minimaps.get(row.map)?.minimapUrl ?? null,
      mapBounds: minimaps.get(row.map)?.bounds ?? null,
      gameplay: row.gameplay,
      battleType: row.battleType,
      duration: row.duration,
      team: row.own.team,
      outcome: outcomeOf(row.own.team, row.winnerTeam),
      tank: namedTank(book[String(row.own.tank)], row.own.tank, slugs),
      own: row.own,
      rating: rateOne(row.own, row.winnerTeam, book, wn8Expected, wnxExpected),
      players: row.players,
      reporters: row.reporters,
      personal: row.personal ?? null,
    });
  }
  return out;
}

/**
 * One battle shaped as the career record the rating accumulators read.
 *
 * Not a trick: the ratings are defined on battle counters and only ever
 * averaged, so a career of one battle is the metric at its own grain. Every
 * term maps straight across, `dropped_capture_points` included, which the
 * results call `capturePoints` on the vehicle that took them back.
 */
function asCareer(own: BattleVehicle, won: boolean): TankStats {
  return {
    tank_id: own.tank,
    all: {
      battles: 1,
      wins: won ? 1 : 0,
      damage_dealt: own.damage,
      spotted: own.spotted,
      frags: own.kills,
      dropped_capture_points: own.capturePoints,
      radio_assisted_damage: own.radio,
      track_assisted_damage: own.track,
      xp: own.xp,
    },
  } as TankStats;
}

function rateOne(
  own: BattleVehicle,
  winnerTeam: number | null,
  book: Record<string, VehicleMeta>,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
): Partial<Record<RatingMetric, number | null>> {
  const one = asCareer(own, winnerTeam === own.team);
  // No (tier, type) fallback: on a career it rescues a vehicle the expected
  // tables have not caught up with, and on a single battle it would quietly
  // rate one vehicle against another's expectations. A missing rating is the
  // honest answer, and the row still shows everything else.
  const noFallback = new Map<string, WN8Expected>();

  const wn7 = wn7AccZero();
  wn7AccAdd(wn7, one, book);

  const wn8 = wn8AccZero();
  wn8AccAdd(wn8, one, wn8Expected, book, noFallback);

  const wnx = wnxAccZero();
  wnxAccAdd(wnx, one, wnxExpected);

  return {
    [RatingMetric.Wn7]: wn7Finalize(wn7),
    [RatingMetric.Wn8]: wn8Finalize(wn8),
    [RatingMetric.Wnx]: wnxFinalize(wnx),
  };
}

function namedTank(
  meta: VehicleMeta | undefined,
  id: number,
  slugs: Map<number, string | null>,
): BattleTank | null {
  if (!meta) return null;
  return {
    id,
    name: meta.name,
    shortName: meta.shortName,
    tier: meta.tier,
    type: meta.type,
    nation: meta.nation,
    tag: meta.tag,
    slug: slugs.get(id) ?? null,
  };
}

/** A participant's public identity, in the shape the site's name component takes. */
export type BattlePlayer = {
  accountId: number;
  nickname: string;
  clanTag: string | null;
  clanColor: string | null;
  isVerified: boolean;
  isSupporter: boolean;
  twitchLogin: string | null;
  tournamentWins: number;
  tournamentFeaturedWins: number;
  tournamentBestTitle: string | null;
  onslaughtBestTier: string | null;
  onslaughtBestRank: number | null;
  onslaughtSeasons: number;
};

/** One participant of a battle, as the detail view reads them. */
export type BattleParticipant = {
  /** Battle-scoped vehicle id, unique within the battle. */
  id: number;
  /** Wargaming account id, absent for a bot. */
  account?: number;
  /**
   * How the site names this player, or null for a bot or an account nobody has
   * ever looked up here.
   *
   * The whole identity, not a nickname: the site has one format for naming a
   * player (name, clan tag, then the crests they have earned) and one component
   * that renders it. A roster that passed only a name would be the one place
   * that drops a supporter's or a tournament winner's crest.
   */
  player: BattlePlayer | null;
  team: number;
  tank: BattleTank | null;
  /** Their whole line's figures, exactly as the results reported them. */
  own: Record<string, number>;
  /** The medals this battle awarded them, by the game's own ids. */
  medals?: number[];
  /** What this battle scored them, per metric. See `PlayerBattle["rating"]`. */
  rating: Partial<Record<RatingMetric, number | null>>;
};

/** A whole battle: both teams, named and rated. */
export type BattleDetail = {
  id: string;
  startedAt: Date;
  map: string;
  gameplay: string | null;
  battleType: number;
  duration: number | null;
  winnerTeam: number | null;
  finishReason: number | null;
  clientVersion: string | null;
  /** The cluster it ran on, when the results carried one. */
  server: string | null;
  /** How many of our players reported it. */
  reporters: number;
  /**
   * Whether the archive holds this battle's replay file.
   *
   * A boolean rather than the key: the key names an object in a private
   * bucket and nothing outside the server has any use for it. This answers
   * the only question a reader has, which is whether the viewer has anything
   * to draw. Expect it false far more often than true.
   */
  hasReplay: boolean;
  /** Every vehicle, both teams, ordered by team then by what they did. */
  participants: BattleParticipant[];
};

/**
 * One battle, whole.
 *
 * **Every participant is rated on this battle, and named where we can name
 * them.** That is the thing worth doing with a row that already holds thirty
 * vehicles: a damage column says who farmed, and a rating against each
 * vehicle's own expectations says who played well, which is not the same
 * question and is the one a reader is actually asking. The accounts are ours
 * to resolve because this site already holds them, so no reader has to be
 * sold the privilege of knowing who they were in a battle with.
 *
 * Bots are left in, unnamed. A team of seven that draws as five because two of
 * them had no account would be a lie about the battle.
 */
export async function battleDetail(
  region: Region,
  arenaUniqueId: string,
): Promise<BattleDetail | null> {
  const table = battlesByRegion[region];
  const rows = await db
    .select()
    .from(table)
    .where(sql`${table.arenaUniqueId} = ${arenaUniqueId}`)
    .limit(1);
  const battle = rows[0];
  if (!battle) return null;

  const accounts = [
    ...new Set(
      battle.vehicles
        .map((vehicle) => vehicle.account)
        .filter((id): id is number => Boolean(id)),
    ),
  ];
  const [book, wn8Expected, wnxExpected, names, badges] = await Promise.all([
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
    nicknamesOf(region, accounts),
    resolvePlayerBadges(region, accounts),
  ]);
  const slugs = new Map<number, string | null>();
  for (const id of new Set(battle.vehicles.map((vehicle) => vehicle.tank))) {
    slugs.set(id, await getTankSlug(region, id));
  }

  const participants = battle.vehicles.map((vehicle) => {
    const known = vehicle.account ? names.get(vehicle.account) : undefined;
    const crests = vehicle.account ? badges.get(vehicle.account) : undefined;
    return {
      id: vehicle.id,
      ...(vehicle.account ? { account: vehicle.account } : {}),
      player:
        known && vehicle.account
          ? {
              accountId: vehicle.account,
              nickname: known.nickname,
              clanTag: known.clanTag,
              clanColor: known.clanColor,
              isVerified: crests?.verified ?? false,
              isSupporter: crests?.supporter ?? false,
              twitchLogin: crests?.twitchLogin ?? null,
              tournamentWins: crests?.tournamentWins ?? 0,
              tournamentFeaturedWins: crests?.tournamentFeaturedWins ?? 0,
              tournamentBestTitle: crests?.tournamentBestTitle ?? null,
              onslaughtBestTier: crests?.onslaughtBestTier ?? null,
              onslaughtBestRank: crests?.onslaughtBestRank ?? null,
              onslaughtSeasons: crests?.onslaughtSeasons ?? 0,
            }
          : null,
      team: vehicle.team,
      tank: namedTank(book[String(vehicle.tank)], vehicle.tank, slugs),
      // Without the medals, which ride as their own field: `own` is a bag of
      // numbers everywhere it is read, and one array in it would make every
      // reader handle a type it has no use for.
      own: withoutMedals(vehicle),
      ...(vehicle.medals?.length ? { medals: vehicle.medals } : {}),
      rating: rateOne(vehicle, battle.winnerTeam, book, wn8Expected, wnxExpected),
    };
  });
  // The player's own team first, then damage: a reader opens this to find
  // themselves and then to see who carried.
  participants.sort(
    (a, b) => a.team - b.team || b.own.damage - a.own.damage,
  );

  return {
    id: battle.arenaUniqueId,
    startedAt: battle.startedAt,
    map: battle.mapName,
    gameplay: battle.gameplayId,
    battleType: battle.battleType,
    duration: battle.duration,
    winnerTeam: battle.winnerTeam,
    finishReason: battle.finishReason,
    clientVersion: battle.clientVersion,
    server: battle.server,
    reporters: battle.reportedBy.length,
    hasReplay: battle.replayKey !== null,
    participants,
  };
}

/**
 * The nicknames we hold for these accounts.
 *
 * A miss is ordinary rather than an error: our players table is everyone the
 * site has ever been asked about, which is a large slice of each region and
 * not all of it. An unnamed participant still has a vehicle and a line.
 */
/** A vehicle's line as a bag of numbers, which is how every reader takes it. */
function withoutMedals(vehicle: BattleVehicle): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(vehicle)) {
    if (typeof value === "number") out[key] = value;
  }
  return out;
}

type KnownPlayer = {
  nickname: string;
  clanTag: string | null;
  clanColor: string | null;
};

async function nicknamesOf(
  region: Region,
  accounts: number[],
): Promise<Map<number, KnownPlayer>> {
  const out = new Map<number, KnownPlayer>();
  if (accounts.length === 0) return out;
  const players = playersByRegion[region];
  const clans = clansByRegion[region];
  // Left join: a player with no clan, or one whose clan we have not read yet,
  // still has a name, and the name is the part that matters.
  const rows = await db
    .select({
      accountId: players.accountId,
      nickname: players.nickname,
      clanTag: clans.tag,
      clanColor: clans.color,
    })
    .from(players)
    .leftJoin(clans, eq(players.clanId, clans.id))
    .where(inArray(players.accountId, accounts));
  for (const row of rows) {
    out.set(row.accountId, {
      nickname: row.nickname,
      clanTag: row.clanTag,
      clanColor: row.clanColor,
    });
  }
  return out;
}
