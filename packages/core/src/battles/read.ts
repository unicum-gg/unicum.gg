import { and, desc, eq, getTableName, gte, inArray, lt, sql } from "drizzle-orm";
import type { Region } from "@unicum.gg/wargaming";
import {
  battleLoadoutsByRegion,
  battlesByRegion,
  clansByRegion,
  playersByRegion,
  RatingMetric,
  type BattleEconomy,
  type LoadoutCrewMember,
  type LoadoutShell,
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
import {
  playerBattlesWhere,
  type PlayerBattleFilter,
} from "@unicum.gg/core/battles/filters";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import { getTankSlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import {
  minimapsByArena,
  type ArenaDrawing,
  type ArenaOverlay,
} from "@unicum.gg/core/wargaming/wot/maps";
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

/** The most a caller may ask for in one go: the largest page the profile's
 * Battles tab offers. */
export const MAX_RECENT_BATTLES = 100;

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
  /**
   * What this battle's own mode puts on the minimap: base flags, spawns, the
   * control point, and Onslaught's capturable points. Already projected into
   * `mapBounds`, which is the same box the vehicles are drawn in, because two
   * boxes is how a flag ends up a quarter of an image from the tanks on it.
   *
   * Null when the arena declares nothing for this mode, and the map then draws
   * bare rather than guessing.
   */
  mapOverlay: ArenaOverlay | null;
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
  /**
   * The optional devices this account had fitted, by slot, for the preview.
   *
   * Keys and not pictures: naming and illustrating an item is the web layer's
   * job, and it needs a locale and a per-vehicle catalogue that have no
   * business in a database read. Absent for the overwhelming majority of
   * battles, because a loadout exists only where a recording carried one.
   *
   * The FIRST life's, in a mode that has several. A row in a list is a glance,
   * and a glance cannot show three sets of three; the battle's own page shows
   * every life.
   */
  devices?: (string | null)[];
  /** Directives fitted, by slot, for the same preview. */
  boosters?: (string | null)[];
  /** Consumables carried, by slot. */
  consumables?: (string | null)[];
  /**
   * The KINDS of round loaded, in order, without the counts.
   *
   * A row is a glance: the kinds say what the gun was fed, and the counts
   * would need a figure under every box and twice the height to say it. The
   * battle's own panel has them.
   */
  shells?: string[];
  /**
   * The field modifications, still packed. See `fieldModSlots` to draw them.
   *
   * Raw here because decoding needs the vehicle's post-progression tree, and a
   * database read has no business fetching catalogues. Present far more often
   * than the rest: a replay carries these for everyone who has any.
   */
  fieldModsPacked?: number[];
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
/**
 * The image, the box and the overlay a battle is drawn with.
 *
 * All three together and from one place, because they have to agree: a mode
 * that shrinks the play area (Onslaught) must hand back ITS box, not the
 * arena's, or the vehicles and the flags are projected differently and the
 * drawing is quietly wrong rather than visibly broken.
 */
/**
 * The picture, its extent and the mode's overlay, all three agreeing.
 *
 * Exported because two readers need it: the battle's own document, and the
 * replay, whose caller may hold nothing else. Resolving the arena twice would
 * be two places for the "a mode can shrink the map" rule to drift apart.
 */
export function drawing(
  arena: ArenaDrawing | undefined,
  gameplay: string | null,
): {
  mapImage: string | null;
  mapBounds: ArenaOverlay["bounds"] | null;
  mapOverlay: ArenaOverlay | null;
} {
  const overlay = gameplay ? (arena?.overlays[gameplay] ?? null) : null;
  return {
    // The overlay's own picture wins. This function exists to hand back a
    // box and an image that agree, and it used to take the box from the
    // overlay and the image from the arena: an Onslaught battle on a map
    // that also runs random battles was drawn on the full-size picture with
    // the reduced mode's coordinates, so the right map was the wrong map.
    mapImage: overlay?.minimapUrl ?? arena?.minimapUrl ?? null,
    mapBounds: overlay?.bounds ?? arena?.bounds ?? null,
    mapOverlay: overlay,
  };
}

/**
 * How many battles we hold that this account fought, for the Battles tab's
 * label and its last page.
 *
 * The same filter the list reads, on the same GIN index over `player_ids`, so
 * it costs what one page does: a few milliseconds on an account with hundreds.
 */
export async function countPlayerBattles(
  region: Region,
  accountId: number,
  filter: PlayerBattleFilter = {},
): Promise<number> {
  const table = battlesByRegion[region];
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(playerBattlesWhere(table, accountId, filter));
  return row?.count ?? 0;
}

export async function recentBattlesOf(
  region: Region,
  accountId: number,
  limit: number = RECENT_BATTLES,
  /** How many of the newest to skip, for a page past the first. */
  offset = 0,
  filter: PlayerBattleFilter = {},
): Promise<PlayerBattle[]> {
  const table = battlesByRegion[region];
  const wanted = Math.min(Math.max(1, Math.trunc(limit)), MAX_RECENT_BATTLES);
  const rows = await battleRows(region, accountId)
    .where(playerBattlesWhere(table, accountId, filter))
    .orderBy(desc(table.startedAt))
    .limit(wanted)
    .offset(Math.max(0, Math.trunc(offset)));
  return assembleBattles(region, accountId, rows);
}

/**
 * One battle, as the row of `accountId`'s list would draw it, or null.
 *
 * For a surface that already knows which battles it wants (a vehicle's best
 * battles, one per player) and must draw them exactly as the player's own
 * Battles tab does. Found by the primary key, so it is one index probe.
 */
export async function battleOfAccount(
  region: Region,
  accountId: number,
  id: string,
  startedAt: Date,
): Promise<PlayerBattle | null> {
  const table = battlesByRegion[region];
  const rows = await battleRows(region, accountId)
    .where(and(eq(table.startedAt, startedAt), eq(table.arenaUniqueId, id)))
    .limit(1);
  return (await assembleBattles(region, accountId, rows))[0] ?? null;
}

/**
 * The columns a battle row is read with, for one account, before any filter.
 *
 * Shared by the list and the single-battle read so the two can never draw a
 * battle differently.
 */
function battleRows(region: Region, accountId: number) {
  const table = battlesByRegion[region];
  const loadouts = battleLoadoutsByRegion[region];
  /** This table's own name, to qualify it inside the subquery below. */
  const outer = sql.identifier(getTableName(table));
  return db
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
      // What they had fitted, for the preview on the row. A correlated
      // subquery rather than a join or a second round trip: it rides the
      // loadout table's primary key, which starts with the same two columns
      // this row is already found by, and it answers null for the battles
      // that have no loadout without costing them anything.
      //
      // The outer columns are qualified BY HAND, and they have to be. Passing
      // the column objects renders them bare -- `l.started_at = "started_at"`
      // -- and Postgres then resolves that name against the innermost table
      // that has it, which is `l`. The predicate becomes `l.started_at =
      // l.started_at`, always true, and the subquery quietly returns any
      // loadout the account ever had: every battle in the list showed the
      // same three devices, including battles with no loadout at all. It
      // reads correctly and is wrong, which is the worst way to be wrong.
      // One row of the loadout table as JSON, rather than four subqueries
      // for four columns: the correlation and the index probe are the cost
      // here, and paying it once for the whole row is the difference between
      // one lookup per battle and four.
      loadout: sql<{
        opt_devices: (string | null)[] | null;
        boosters: (string | null)[] | null;
        consumables: (string | null)[] | null;
        shells: { type: string }[] | null;
        field_mods_packed: number[] | null;
      } | null>`(
        SELECT to_jsonb(l) FROM ${loadouts} l
        WHERE l.started_at = ${outer}.started_at
          AND l.arena_unique_id = ${outer}.arena_unique_id
          AND l.account_id = ${accountId}
        ORDER BY l.life
        LIMIT 1
      )`,
    })
    .from(table)
    .$dynamic();
}

type BattleRowRecord = Awaited<ReturnType<ReturnType<typeof battleRows>["execute"]>>[number];

/** Rows of `battleRows`, named, rated and drawn. */
async function assembleBattles(
  region: Region,
  accountId: number,
  rows: BattleRowRecord[],
): Promise<PlayerBattle[]> {

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
      ...drawing(minimaps.get(row.map), row.gameplay),
      gameplay: row.gameplay,
      battleType: row.battleType,
      duration: row.duration,
      team: row.own.team,
      outcome: outcomeOf(row.own.team, row.winnerTeam),
      tank: namedTank(book[String(row.own.tank)], row.own.tank, slugs),
      own: row.own,
      rating: rateOne(row.own, row.winnerTeam, book, wn8Expected, wnxExpected),
      ...(row.loadout
        ? {
            ...(row.loadout.opt_devices?.length
              ? { devices: row.loadout.opt_devices }
              : {}),
            // By slot, empty ones included: a directive slot left free is
            // part of the build, and drawn as a free slot like a free device
            // slot, rather than the whole group vanishing.
            // A layout with no directive mounted can arrive with its slot list
            // empty rather than holding a free slot. Every vehicle has one, so
            // a battle that carries a loadout shows it free.
            ...(row.loadout.boosters?.length
              ? { boosters: row.loadout.boosters }
              : row.loadout.opt_devices?.length
                ? { boosters: [null] }
                : {}),
            ...(row.loadout.consumables?.length
              ? { consumables: row.loadout.consumables }
              : {}),
            ...(row.loadout.shells?.length
              ? { shells: row.loadout.shells.map((shell) => shell.type) }
              : {}),
            ...(row.loadout.field_mods_packed?.length
              ? { fieldModsPacked: row.loadout.field_mods_packed }
              : {}),
          }
        : {}),
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
    // `TankStats` comes from Wargaming, where a career always names its
    // vehicle, so the type has no room for an unknown one. 0 is not stored
    // anywhere and matches no entry in the encyclopedia or the expected
    // tables, which is exactly what is wanted here: a vehicle nobody can name
    // gets no rating, the same answer `rateOne` gives a tank the expected
    // values have not caught up with.
    tank_id: own.tank ?? 0,
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
  id: number | null,
  slugs: Map<number, string | null>,
): BattleTank | null {
  // Two ways to have no tank to name, answered the same way: the client never
  // reported which vehicle it was, or the catalogue has no entry for the one
  // it did report, which happens to a tank released since the last import.
  if (!meta || id === null) return null;
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
  /** What they had fitted, per life, when a recording of this battle said so. */
  loadouts?: BattleLoadout[];
};

/**
 * What one vehicle had fitted for one life, where a recording says so.
 *
 * Present only for the player whose client recorded the battle, because that
 * is the only vehicle a replay carries this for: the server strips the optional
 * devices out of every other vehicle's public information before broadcasting
 * it. So expect this on at most one participant, and on none at all for a
 * battle whose replay was never offered.
 *
 * An array because a respawn mode gives one loadout per life, in the order they
 * were played.
 */
export type BattleLoadout = {
  /** Counted from zero, in the order the lives were played. */
  life: number;
  /** The devices fitted, by slot; a free slot is a null in place. */
  optDevices: (string | null)[];
  boosters: (string | null)[];
  consumables: (string | null)[];
  shells: LoadoutShell[];
  /** One entry per seat, each with the skills that seat was taught. */
  crew: LoadoutCrewMember[];
  /** The vehicle this life was played in, when the recording named it. Null
   * for a respawn, whose vehicle is the participant's own. */
  tankId: number | null;
  /** The field modifications, still packed. See `fieldModSlots` to draw them. */
  fieldModsPacked: number[];
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
  /**
   * The minimap, its extent and the mode's overlay, all three agreeing.
   *
   * Here as well as on a list row because a battle has a page of its own now,
   * and a page resolving its own arena would be a second place for the
   * mode-shrinks-the-map rule to be got wrong.
   */
  mapImage: string | null;
  mapBounds: ArenaOverlay["bounds"] | null;
  mapOverlay: ArenaOverlay | null;
  /**
   * The mark of excellence this battle moved, when we can see it move.
   *
   * `percent` is where the gun stood when the battle ended, which the results
   * carry. `previous` is where it stood at the end of the last battle the same
   * account played in the same tank, which nothing carries: the game gives no
   * "before" to pair with the "after" the way the mastery badge has one, so
   * the only way to know what a battle GAINED is to look at the battle before
   * it. That is a question about a series and belongs here, not in the client.
   *
   * Null when the reporter ran a client too old to send it, when the mode does
   * not count towards marks, or when this is the first battle we hold for that
   * tank. `previous` alone can be null while `percent` is not: a first battle
   * has a standing and no movement.
   *
   * `account` is WHOSE gun this is, and it has to be said rather than assumed.
   * The figure comes from the reporting client's own results, so it belongs to
   * one player in the battle and to nobody else; a reader looking at another
   * participant's page is looking at a stranger's mark unless the two match.
   */
  mark: { percent: number; previous: number | null; account: number } | null;
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
  const [book, wn8Expected, wnxExpected, names, badges, minimaps] =
    await Promise.all([
      getVehicleEncyclopedia(region),
      getWN8ExpectedValues(),
      getWNXExpectedValues(),
      nicknamesOf(region, accounts),
      resolvePlayerBadges(region, accounts),
      minimapsByArena(region),
    ]);
  // Read whatever a recording of this battle was able to say about what was
  // fitted. Decoded once when the file arrived, not here: this is a plain
  // lookup on the same partition key the battle itself was found by.
  const fitted = await loadoutsOf(region, arenaUniqueId, battle.startedAt);
  const slugs = new Map<number, string | null>();
  for (const id of new Set(
    battle.vehicles
      .map((vehicle) => vehicle.tank)
      .filter((id): id is number => id !== null),
  )) {
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
      ...(fitted.get(vehicle.id)?.length
        ? { loadouts: fitted.get(vehicle.id) }
        : {}),
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
    mark: await markMove(region, battle),
    map: battle.mapName,
    gameplay: battle.gameplayId,
    battleType: battle.battleType,
    duration: battle.duration,
    winnerTeam: battle.winnerTeam,
    finishReason: battle.finishReason,
    clientVersion: battle.clientVersion,
    server: battle.server,
    reporters: battle.reportedBy.length,
    ...drawing(minimaps.get(battle.mapName), battle.gameplayId),
    hasReplay: battle.replayKey !== null,
    participants,
  };
}

/**
 * What a recording of this battle said was fitted, by vehicle.
 *
 * Keyed on the vehicle rather than the account because that is the key the
 * rows carry and the key the participants are matched by, and because a bot
 * has a vehicle but no account. Ordered by life so the first entry is the
 * first tank taken out.
 *
 * Empty for the overwhelming majority of battles, which is the designed state:
 * a loadout only exists here if somebody's client offered the replay, and the
 * game keeps one replay at a time by default.
 */
async function loadoutsOf(
  region: Region,
  arenaUniqueId: string,
  startedAt: Date,
): Promise<Map<number, BattleLoadout[]>> {
  const table = battleLoadoutsByRegion[region];
  const rows = await db
    .select({
      vehicleId: table.vehicleId,
      life: table.life,
      optDevices: table.optDevices,
      boosters: table.boosters,
      consumables: table.consumables,
      shells: table.shells,
      crew: table.crew,
      tankId: table.tankId,
      fieldModsPacked: table.fieldModsPacked,
    })
    .from(table)
    // `eq` rather than a raw `sql` template: the template has no idea the
    // column is a timestamptz and hands the driver the Date untouched, which
    // fails with "the string argument must be of type string ... received an
    // instance of Date". The comparison helpers carry the column's type.
    .where(
      and(
        eq(table.startedAt, startedAt),
        eq(table.arenaUniqueId, arenaUniqueId),
      ),
    );

  const out = new Map<number, BattleLoadout[]>();
  for (const row of rows.sort((a, b) => a.life - b.life)) {
    const list = out.get(row.vehicleId) ?? [];
    list.push({
      life: row.life,
      optDevices: row.optDevices ?? [],
      boosters: row.boosters ?? [],
      consumables: row.consumables ?? [],
      shells: row.shells ?? [],
      crew: row.crew ?? [],
      tankId: row.tankId,
      fieldModsPacked: row.fieldModsPacked ?? [],
    });
    out.set(row.vehicleId, list);
  }
  return out;
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

/**
 * Where this battle left the gun, and where the one before it did.
 *
 * Asked of the battles table rather than derived from anything on this row,
 * because the movement is a fact about two battles and only one of them is
 * here. The previous battle is the latest one the SAME account played in the
 * SAME tank before this one, which is why both halves of that have to be
 * matched: an account that played three tanks this evening has three separate
 * series running, and reading across them would show a mark leaping about.
 *
 * **Why it is a second query.** The figure sits inside the `personal` document
 * of a battle row, so there is no column to join on and no index that would
 * help; a lateral over the partitioned table would read the same month either
 * way. One extra statement on the page of a single battle is a fair price, and
 * nothing else on the page pays it.
 *
 * Returns null rather than a zero movement when there is nothing to say. A
 * battle whose reporter sent no percent, or a mode that does not count towards
 * marks, has no standing to report; showing 0 % there would read as a gun that
 * lost everything.
 */
/** How far back a previous battle may sit and still count as "the one before". */
const MARK_WINDOW = 45 * 24 * 60 * 60 * 1000;

async function markMove(
  region: Region,
  battle: { arenaUniqueId: string; startedAt: Date; personal: BattleEconomy | null; reportedBy: number[]; vehicles: BattleVehicle[] },
): Promise<{ percent: number; previous: number | null; account: number } | null> {
  const percent = battle.personal?.markPercent;
  if (percent == null) return null;

  // The tank the reporter played, which is the one the percent belongs to.
  // The results name the reporting account, and that account's vehicle in this
  // battle names the tank; without it there is a percent and no series to put
  // it in.
  const account = Number(battle.reportedBy[0]);
  // Without a nameable owner the figure cannot be shown to anybody safely, so
  // it is not shown at all: an unattributed mark on a page reads as that
  // page's player, which is the one thing it must never do.
  if (!Number.isFinite(account)) return null;
  const own = battle.vehicles.find((vehicle) => vehicle.account === account);
  if (!own?.tank) return { percent, previous: null, account };

  const table = battlesByRegion[region];
  const [before] = await db
    .select({ personal: table.personal })
    .from(table)
    .where(
      and(
        lt(table.startedAt, battle.startedAt),
        // And no further back than this. Two reasons, and either alone would
        // be enough. The table is partitioned by month, so an unbounded `<`
        // reads every partition there has ever been to find one row. And a
        // standing from two months ago is not what this battle moved from: a
        // gap that long means the tank was parked, and drawing an arrow
        // across it would credit one battle with a season of play.
        gte(table.startedAt, new Date(battle.startedAt.getTime() - MARK_WINDOW)),
        // `array[...]::bigint[]` spelled out rather than a bound array: the
        // driver flattens a one-element array parameter back to a scalar and
        // then refuses it, which is a bind error at request time and not a
        // type error at build time.
        sql`${table.reportedBy} @> array[${account}]::bigint[]`,
        sql`${table.personal} ->> 'markPercent' is not null`,
        sql`exists (
          select 1 from jsonb_array_elements(${table.vehicles}) as v
          where (v ->> 'account')::bigint = ${account}
            and (v ->> 'tank')::bigint = ${own.tank}
        )`,
      ),
    )
    .orderBy(desc(table.startedAt))
    .limit(1);

  const was = before?.personal?.markPercent;
  return { percent, previous: typeof was === "number" ? was : null, account };
}

