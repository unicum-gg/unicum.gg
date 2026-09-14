import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  clanMembersByRegion,
  clansByRegion,
  LanguageSource,
  playersByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { discoverClansBackground } from "../discovery/clans";
import { discoverPlayersBackground } from "../discovery/players";
import {
  MAX_IDS_PER_KIND,
  resolveLanguages,
  type ResolvedLanguages,
} from "../languages";

/**
 * The two windows every rated entity is described by.
 *
 * `total` is lifetime and `recent` is the last 30 days, the same pair the site
 * shows, and both halves of a window come from ONE pass over the same data: a
 * win rate printed beside a rating has to describe the battles that produced
 * it. That is the whole reason `wins_30d` exists (migration 0106).
 */
export type RatingWindow = {
  // All three metrics, because the reader picks theirs in the navbar and an
  // endpoint that answered in two of them would decide for every caller which
  // ones are worth having. The columns already carry all three.
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  battles: number | null;
  /** Percentage, 0..100, as the site shows it. Null when no battles fell in the
   * window, which is not the same as a win rate of zero. */
  winrate: number | null;
};

export type ResolvedPlayer = {
  nickname: string;
  clan: { id: number; tag: string; color: string } | null;
  languages: string[];
  countries: (string | null)[];
  languageSource: LanguageSource | null;
  ratings: { total: RatingWindow; recent: RatingWindow };
  updatedAt: Date;
};

export type ResolvedClan = {
  tag: string;
  name: string;
  color: string;
  membersCount: number;
  languages: string[];
  countries: (string | null)[];
  languageSource: LanguageSource | null;
  ratings: { total: RatingWindow; recent: RatingWindow; avgWinrate: number | null };
  updatedAt: Date | null;
};

export type EntityResolution = {
  players: Record<number, ResolvedPlayer>;
  clans: Record<number, ResolvedClan>;
  /** Tag to clan id, for a caller holding only what a roster printed. The clan
   * itself lands in `clans`, so a tag costs one lookup rather than a lookup and
   * then a second request. */
  tags: Record<string, number>;
};

/** How many entries one call resolves per kind. Re-exported rather than
 * re-declared: the language lookup this builds on documents the same ceiling,
 * and two constants for one contract is one of them going stale. */
export { MAX_IDS_PER_KIND } from "../languages";

/** How many unknown ids one call may hand to discovery. A quarter of the read
 * ceiling: a roster we know nothing about is not a roster, and the cost of
 * being wrong here is paid by the snapshot pipeline rather than by the caller,
 * which is exactly the kind of cost that should not be uncapped. */
const MAX_DISCOVERIES_PER_CALL = 25;

/**
 * Everything a caller holding a roster needs about each name on it, in one
 * request: the language flags, the ratings, the win rates, and the clan a
 * player wears.
 *
 * The point is that it is ONE request. A mod drawing a skirmish room used to
 * need a languages call, a full player document per player (several hundred
 * kilobytes for four numbers) and a full clan document per clan, and the player
 * documents are addressed by nickname, which a Flash roster does not always
 * carry. Everything here is addressed by the ids the client actually hands over.
 *
 * Reads local tables only, never Wargaming.
 */
export async function resolveEntities(
  region: Region,
  ids: { players: number[]; clans: number[]; tags: string[] },
): Promise<EntityResolution> {
  // Tags first: a tag resolves to a clan id, and that clan is then resolved
  // alongside the ones asked for by id, so a caller mixing the two forms never
  // gets the same clan described twice.
  const tags = await resolveTags(region, ids.tags);
  // Capped AFTER the tags expand into ids: the route bounds each list on its
  // own, so 100 clan ids plus 100 tags naming other clans would otherwise walk
  // past the ceiling every reader below assumes, this module's own SQL builder
  // included.
  const clanIds = Array.from(
    new Set([...ids.clans, ...Object.values(tags)]),
  ).slice(0, MAX_IDS_PER_KIND);

  const [languages, players, clans] = await Promise.all([
    resolveLanguages(region, { players: ids.players, clans: clanIds }),
    loadPlayers(region, ids.players),
    loadClans(region, clanIds),
  ]);

  for (const [id, row] of Object.entries(players.players)) {
    attachLanguages(row, languages.players[Number(id)]);
  }
  for (const [id, row] of Object.entries(clans)) {
    attachLanguages(row, languages.clans[Number(id)]);
  }

  // An id nobody has ever asked us about is the one thing a roster tells us
  // that no crawl of ours can: discovery walks clan rosters, so a player in no
  // clan is reachable from nowhere else. Probing six ids at random turned up two
  // real accounts of 2011 with thousands of battles that nothing had ever led us
  // to. They are queued rather than fetched, and this answer stays exactly as it
  // was: the caller learns nothing new today, and the same id carries data the
  // next time it is asked for.
  //
  // Fire-and-forget on purpose. This is a read endpoint, and a caller waiting on
  // a write it did not ask for would pay for a benefit it does not receive.
  //
  // Bounded per call, unlike the search endpoint next door, and the difference
  // is who chose the ids: search discovers what WARGAMING answered, so every id
  // is an account that exists, while here the CALLER hands them over and we
  // insert what we are told. An id that names nothing still costs a row and
  // three fetches before it is soft-deleted, so a caller sending noise, whether
  // by malice or by a bug, must not be able to fill the table one request at a
  // time. A real roster is mostly accounts we already hold, so this ceiling is
  // far above what one honestly has to report.
  discoverPlayersBackground(
    region,
    ids.players
      .filter((id) => !players.known.has(id))
      .slice(0, MAX_DISCOVERIES_PER_CALL)
      .map((accountId) => ({ accountId })),
  );
  discoverClansBackground(
    region,
    clanIds
      .filter((id) => clans[id] === undefined)
      .slice(0, MAX_DISCOVERIES_PER_CALL),
  );

  return { players: players.players, clans, tags };
}

/** The language block is flattened onto the entity rather than nested, since a
 * caller drawing a flag wants the codes beside the name, not a sub-object to
 * reach into. An entity we hold no language for keeps empty lists and a null
 * source, which is how it differs from one we hold nothing at all for: that one
 * is absent from the response entirely. */
function attachLanguages(
  row: { languages: string[]; countries: (string | null)[]; languageSource: LanguageSource | null },
  resolved: ResolvedLanguages | undefined,
): void {
  if (!resolved) return;
  row.languages = resolved.languages;
  row.countries = resolved.countries;
  row.languageSource = resolved.source;
}

/** Tags are matched case-insensitively on the indexed `tag_lower`, and the key
 * echoes back what the caller wrote, so a roster that printed `mafio` can pair
 * the answer to its own row without re-casing anything. */
async function resolveTags(
  region: Region,
  tags: string[],
): Promise<Record<string, number>> {
  if (tags.length === 0) return {};
  const clans = clansByRegion[region];
  const lowered = tags.map((t) => t.toLowerCase());
  const rows = await db
    .select({ id: clans.id, tagLower: clans.tagLower })
    .from(clans)
    .where(inArray(clans.tagLower, lowered));

  const byLower = new Map(rows.map((r) => [r.tagLower, Number(r.id)]));
  const out: Record<string, number> = {};
  for (const tag of tags) {
    const id = byLower.get(tag.toLowerCase());
    if (id !== undefined) out[tag] = id;
  }
  return out;
}

/**
 * One indexed read: every figure here is denormalised onto the player row by the
 * snapshot pipeline, so this never opens the snapshots the numbers were derived
 * from. Soft-deleted accounts answer nothing, like everywhere else.
 */
async function loadPlayers(
  region: Region,
  accountIds: number[],
): Promise<{ players: Record<number, ResolvedPlayer>; known: Set<number> }> {
  if (accountIds.length === 0) return { players: {}, known: new Set() };
  const players = playersByRegion[region];
  const clans = clansByRegion[region];
  const rows = await db
    .select({
      accountId: players.accountId,
      nickname: players.nickname,
      lastSeenAt: players.lastSeenAt,
      clanId: players.clanId,
      softDeletedAt: players.softDeletedAt,
      clanTag: clans.tag,
      clanColor: clans.color,
      wn7: players.wn7,
      wn8: players.wn8,
      wnx: players.wnx,
      battles: players.battles,
      winrate: players.winrate,
      wn730d: players.wn730d,
      wn830d: players.wn830d,
      wnx30d: players.wnx30d,
      battles30d: players.battles30d,
      wins30d: players.wins30d,
    })
    .from(players)
    .leftJoin(clans, eq(clans.id, players.clanId))
    // Soft-deleted rows are read and then dropped below rather than filtered in
    // SQL, because "we hold no row" and "we hold a row we will not publish" are
    // different answers: only the first is an account worth discovering, and a
    // purged one must not be re-queued on every roster it appears in.
    .where(inArray(players.accountId, accountIds));

  const known = new Set(rows.map((r) => Number(r.accountId)));
  const out: Record<number, ResolvedPlayer> = {};
  for (const r of rows) {
    if (r.softDeletedAt !== null) continue;
    out[Number(r.accountId)] = {
      nickname: r.nickname,
      clan:
        r.clanId != null && r.clanTag
          ? { id: Number(r.clanId), tag: r.clanTag, color: r.clanColor ?? "#4a4a4a" }
          : null,
      languages: [],
      countries: [],
      languageSource: null,
      ratings: {
        // `winrate` is stored as a 0..1 fraction on the row and as a percentage
        // in the payload, which is the convention the rest of the API uses.
        total: {
          wn7: r.wn7,
          wn8: r.wn8,
          wnx: r.wnx,
          battles: r.battles,
          winrate: r.winrate == null ? null : r.winrate * 100,
        },
        recent: {
          wn7: r.wn730d,
          wn8: r.wn830d,
          wnx: r.wnx30d,
          battles: r.battles30d,
          winrate: ratio(r.wins30d, r.battles30d),
        },
      },
      updatedAt: r.lastSeenAt,
    };
  }
  return { players: out, known };
}

/**
 * The clan row, plus its ratings aggregated over its own roster in the same
 * query.
 *
 * Battle-weighted like `computeClanRatings`, and weighted by the window's own
 * battle count in each case, so `recent` weighs a member by what they played in
 * the last thirty days rather than by a career that says nothing about the
 * clan's current form. Aggregated here rather than read from `*_clan_ratings`,
 * which materializes lifetime only and drops any clan under 25 rated members:
 * on a Stronghold roster those are exactly the clans a caller is looking at.
 */
async function loadClans(
  region: Region,
  clanIds: number[],
): Promise<Record<number, ResolvedClan>> {
  if (clanIds.length === 0) return {};
  const clans = clansByRegion[region];
  const members = clanMembersByRegion[region];
  const players = playersByRegion[region];

  // A literal id list rather than `= ANY($1)`: the driver hands a JS array to
  // postgres as a single parameter and refuses it, since it cannot know the
  // element type. The list is capped at MAX_IDS_PER_KIND, so it stays small.
  const idList = sql.join(
    clanIds.map((id) => sql`${id}`),
    sql`, `,
  );

  const weighted = (value: string, weight: string) =>
    sql.raw(
      `(SUM(p."${value}" * cm."${weight}") FILTER (WHERE p."${value}" IS NOT NULL AND cm."${weight}" > 0)` +
        ` / NULLIF(SUM(cm."${weight}") FILTER (WHERE p."${value}" IS NOT NULL AND cm."${weight}" > 0), 0))::float8`,
    );
  // The recent window weighs by what the member played in it, which lives on the
  // player row rather than on the membership row.
  const weightedRecent = (value: string) =>
    sql.raw(
      `(SUM(p."${value}" * p.battles_30d) FILTER (WHERE p."${value}" IS NOT NULL AND p.battles_30d > 0)` +
        ` / NULLIF(SUM(p.battles_30d) FILTER (WHERE p."${value}" IS NOT NULL AND p.battles_30d > 0), 0))::float8`,
    );

  const rows = await db.execute<ClanRow>(sql`
    WITH roster AS (
      SELECT
        cm.clan_id,
        ${weighted("wn7", "overall_battles")} AS wn7,
        ${weighted("wn8", "overall_battles")} AS wn8,
        ${weighted("wnx", "overall_battles")} AS wnx,
        SUM(cm.overall_battles)::bigint AS battles,
        ${weighted("winrate", "overall_battles")} AS winrate,
        ${weightedRecent("wn7_30d")} AS wn7_30d,
        ${weightedRecent("wn8_30d")} AS wn8_30d,
        ${weightedRecent("wnx_30d")} AS wnx_30d,
        SUM(p.battles_30d)::bigint AS battles_30d,
        -- Both sums FILTERed on the same population, which is not pedantry
        -- here: wins_30d is nullable with no backfill (migration 0106), so a
        -- clan whose members are half re-snapshotted would otherwise divide the
        -- wins of a few by the battles of everyone. Measured before the filter:
        -- a clan really winning 50 percent published 0.1 percent.
        SUM(p.wins_30d) FILTER (WHERE p.wins_30d IS NOT NULL)::bigint AS wins_30d,
        SUM(p.battles_30d) FILTER (WHERE p.wins_30d IS NOT NULL)::bigint AS wins_battles_30d
      FROM ${members} cm
      INNER JOIN ${players} p ON p.account_id = cm.account_id AND p.soft_deleted_at IS NULL
      WHERE cm.clan_id IN (${idList})
      GROUP BY cm.clan_id
    )
    SELECT
      c.id, c.tag, c.name, c.color, c.members_count, c.last_refreshed_at,
      r.wn7, r.wn8, r.wnx, r.battles, r.winrate,
      r.wn7_30d, r.wn8_30d, r.wnx_30d, r.battles_30d, r.wins_30d, r.wins_battles_30d
    FROM ${clans} c
    LEFT JOIN roster r ON r.clan_id = c.id
    WHERE c.id IN (${idList})
  `);

  const out: Record<number, ResolvedClan> = {};
  for (const r of rows) {
    out[Number(r.id)] = {
      tag: r.tag,
      name: r.name,
      color: r.color,
      membersCount: r.members_count,
      languages: [],
      countries: [],
      languageSource: null,
      ratings: {
        total: {
          wn7: r.wn7,
          wn8: r.wn8,
          wnx: r.wnx,
          battles: r.battles == null ? null : Number(r.battles),
          winrate: r.winrate == null ? null : r.winrate * 100,
        },
        recent: {
          wn7: r.wn7_30d,
          wn8: r.wn8_30d,
          wnx: r.wnx_30d,
          battles: r.battles_30d == null ? null : Number(r.battles_30d),
          // Over the battles of the members the wins are known for, not over
          // the roster's whole recent battle count.
          winrate: ratio(
            r.wins_30d == null ? null : Number(r.wins_30d),
            r.wins_battles_30d == null ? null : Number(r.wins_battles_30d),
          ),
        },
        // Deliberately the same number as `total.winrate`, under the name a
        // clan is usually described by. It is OUR figure, weighted over the
        // members' stored lifetime win rates, while the clan page builds its
        // own from the portal's `winsPercentage`, so the two can differ a
        // little and this must not be documented as that page's value.
        avgWinrate: r.winrate == null ? null : r.winrate * 100,
      },
      // Rebuilt into a Date: this row comes from a raw `db.execute`, which hands
      // timestamps back as strings, where the player half goes through the
      // query builder and gets Dates. Left alone, one response would carry two
      // date formats and the SDK's date revival would only heal one of them.
      updatedAt: r.last_refreshed_at ? new Date(r.last_refreshed_at) : null,
    };
  }
  return out;
}

type ClanRow = {
  id: number | string;
  tag: string;
  name: string;
  color: string;
  members_count: number;
  last_refreshed_at: string | Date | null;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  battles: number | string | null;
  winrate: number | null;
  wn7_30d: number | null;
  wn8_30d: number | null;
  wnx_30d: number | null;
  battles_30d: number | string | null;
  wins_30d: number | string | null;
  wins_battles_30d: number | string | null;
};

/** A percentage, or null when the window holds no battles: a player who played
 * nothing has no win rate, which is not a win rate of zero. */
function ratio(wins: number | null, battles: number | null): number | null {
  if (wins == null || battles == null || battles <= 0) return null;
  return (wins / battles) * 100;
}
