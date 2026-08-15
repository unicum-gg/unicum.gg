import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  ASSETS_BRANCH,
  ASSETS_REPO,
  onslaughtRatingsByRegion,
  onslaughtSeasonsByRegion,
  playerNameHistoryByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { getPlayerClansBatch } from "@unicum.gg/core/wargaming/wot/clans/listings";
import { type Region } from "@unicum.gg/wargaming";
import { wg } from "../../client";

// Season metadata for the Onslaught board: the window it covers plus the rank
// thresholds the display colors by (Elite / Master). Dates are ISO strings so
// they cross the API unchanged; `lastRecalculationTs` is unix seconds, the
// source's own "last recomputed" stamp (a finished season stops moving).
export type OnslaughtSeason = {
  eventId: string;
  name: string;
  // The season codename ("Season of the Jade Dragon"), from the client
  // localization (the event board only carries the mode name "Competitive 7").
  // Null when the localization can't be read.
  codename: string | null;
  // The season's ordinal word ("third" for Jade), selecting its themed rank art.
  // Null when the localization can't be read.
  seasonOrdinal: string | null;
  // The wot.assets mirror ref to build rank-art URLs from: null for the current
  // season (use the live branch), or the mirror commit as of a past season's end
  // date (so its art is the one that was live then, not a later year's).
  assetsRef: string | null;
  startDate: string | null;
  endDate: string | null;
  // True once the season's end date has passed (standings are final). Computed
  // server-side so the page never calls an impure clock during render.
  ended: boolean;
  elitePosition: number | null;
  masterPosition: number | null;
  lastRecalculationTs: number | null;
};

// One standings row. `account_id` is the only stable key: players rename and
// change clans, so the nickname/clan the source recorded at ranking time go
// stale. We therefore resolve the CURRENT nickname/clan by account_id and surface
// both, so the UI links to who the player is now and can note "(as <recorded>)".
export type OnslaughtRow = {
  rank: number;
  account_id: number;
  // Current identity, resolved by account_id (falls back to the recorded values
  // when Wargaming can't resolve the account, e.g. it was deleted).
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  // The identity as it stood on the leaderboard when the season was recorded.
  recordedNickname: string;
  recordedClanTag: string | null;
  recordedClanColor: string | null;
  rating: number;
  battles: number;
};

// One entry of the season selector. The list mirrors the game's own history (the
// current year's seasons + past years as aggregate archives), so a viewer sees
// we know every season; `available` marks the ones we actually hold standings
// for (the rest render disabled, which is the point — it signals completeness).
export type OnslaughtSeasonRef = {
  key: string;
  label: string;
  available: boolean;
  eventId: string | null;
};

// The wot.assets mirror commit that was HEAD at (or before) a given time, so a
// past season's rank art resolves to what the mirror held while it was live
// (the client overwrites those files each year). Cached: a finished season's end
// date never moves, so the answer is stable. Fails open to null (the caller then
// uses the live branch).
const mirrorCommitCache = new Map<string, string | null>();
async function mirrorCommitAt(untilIso: string): Promise<string | null> {
  const cached = mirrorCommitCache.get(untilIso);
  if (cached !== undefined) return cached;
  let sha: string | null = null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${ASSETS_REPO}/commits?sha=${ASSETS_BRANCH}&until=${encodeURIComponent(untilIso)}&per_page=1`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "unicum.gg",
        },
      },
    );
    if (res.ok) {
      const data = (await res.json()) as Array<{ sha?: string }>;
      sha = data[0]?.sha ?? null;
    }
  } catch {
    sha = null;
  }
  mirrorCommitCache.set(untilIso, sha);
  return sha;
}

/**
 * The Onslaught (Competitive 7) leaderboard for a region: one season's standings
 * in rank order, that season's metadata, and the list of all seasons (newest
 * first) for the selector. `eventId` picks a specific season; omitted, it is the
 * current (most recently started) one. A pure read of the `*_onslaught_*` tables
 * the private feeder populates (this codebase never touches the in-game source),
 * so it is a couple of cheap indexed queries. Finished seasons stay in the table
 * under their own `event_id` with a frozen codename/rank-art ordinal.
 */
export async function getOnslaughtLeaderboard(
  region: Region,
  limit: number,
  eventId?: string,
): Promise<{
  season: OnslaughtSeason | null;
  seasons: OnslaughtSeasonRef[];
  results: OnslaughtRow[];
}> {
  const ratings = onslaughtRatingsByRegion[region];
  const seasons = onslaughtSeasonsByRegion[region];

  // All seasons, newest first: the head is the current season (the default), the
  // whole list feeds the selector.
  const allSeasons = await db
    .select()
    .from(seasons)
    .orderBy(desc(seasons.startDate));
  if (allSeasons.length === 0)
    return { season: null, seasons: [], results: [] };

  const season =
    (eventId ? allSeasons.find((s) => s.eventId === eventId) : undefined) ??
    allSeasons[0];
  const isCurrent = season.eventId === allSeasons[0].eventId;

  const rows = await db
    .select({
      rank: ratings.rank,
      accountId: ratings.accountId,
      recordedName: ratings.name,
      recordedClanTag: ratings.clanTag,
      recordedClanColor: ratings.clanColor,
      currentName: ratings.currentName,
      currentClanTag: ratings.currentClanTag,
      currentClanColor: ratings.currentClanColor,
      rating: ratings.rating,
      battles: ratings.battles,
    })
    .from(ratings)
    .where(eq(ratings.eventId, season.eventId))
    .orderBy(asc(ratings.rank))
    .limit(limit);

  // Client history (generated from wot-src): the current year's seasons + the
  // finished years kept as aggregate archives. Powers both the codename fallback
  // and the full selector list.
  const comp7 = wg.region(region).source.comp7;
  const [taxonomy, archiveYears] = await Promise.all([
    comp7.seasonTaxonomy().catch(() => null),
    comp7.archiveYears().catch(() => [] as string[]),
  ]);

  // Codename/ordinal come from the frozen per-season stamp. Only the current
  // season can be unstamped (a past season was stamped while it was live); fall
  // back to the client taxonomy's latest season (the client localizes each
  // season as it goes live, so the last is the current one).
  let codename = season.codename;
  let seasonOrdinal = season.seasonOrdinal;
  if ((codename == null || seasonOrdinal == null) && isCurrent) {
    const current = taxonomy?.seasons.at(-1) ?? null;
    if (current) {
      codename ??= current.name;
      seasonOrdinal ??= current.ordinal;
    }
  }

  // The full selector list: every season the game has had, newest first. A
  // season is `available` (selectable) iff we hold its standings; the rest render
  // disabled, which is the point (it shows we know every season). Availability is
  // keyed on the DB rows we hold, NOT the codename stamp: the stamp is frozen by
  // reconcile and lags a fresh capture, and a past year's season must stay
  // reachable even once the current-year taxonomy no longer lists it.
  const dbByCodename = new Map<string, string>(
    allSeasons.flatMap((s) =>
      s.codename ? [[s.codename, s.eventId] as [string, string]] : [],
    ),
  );
  // A just-captured current season isn't stamped yet; it is the live season, so
  // it carries the taxonomy's latest name until reconcile freezes it.
  const newest = allSeasons[0];
  const liveName = taxonomy?.seasons.at(-1)?.name;
  if (newest.codename == null && liveName && !dbByCodename.has(liveName)) {
    dbByCodename.set(liveName, newest.eventId);
  }

  const placed = new Set<string>();
  const seasonsList: OnslaughtSeasonRef[] = [];
  for (const s of [...(taxonomy?.seasons ?? [])].reverse()) {
    const eid = dbByCodename.get(s.name) ?? null;
    if (eid) placed.add(eid);
    seasonsList.push({
      key: eid ?? `season:${s.ordinal}`,
      label: s.name,
      available: eid != null,
      eventId: eid,
    });
  }
  // Anti-orphan: seasons we hold that the current-year taxonomy doesn't list
  // (e.g. a season of a now-archived year, after the year rolled over). Never
  // hide a season we have data for. Newest first, above the aggregate archives.
  for (const s of allSeasons) {
    if (placed.has(s.eventId)) continue;
    placed.add(s.eventId);
    seasonsList.push({
      key: s.eventId,
      label: s.codename ?? s.name,
      available: true,
      eventId: s.eventId,
    });
  }
  for (const year of [...archiveYears].reverse()) {
    seasonsList.push({
      key: `archive:${year}`,
      label: `Year of the ${year}`,
      available: false,
      eventId: null,
    });
  }

  // Rank art: the current season uses the live mirror; a past season uses the
  // mirror as it stood at its end date, so the year's art it had while live is
  // frozen even after a newer year overwrites those files.
  const assetsRef =
    isCurrent || season.endDate == null
      ? null
      : await mirrorCommitAt(season.endDate.toISOString());

  return {
    season: {
      eventId: season.eventId,
      name: season.name,
      codename,
      seasonOrdinal,
      assetsRef,
      startDate: season.startDate?.toISOString() ?? null,
      endDate: season.endDate?.toISOString() ?? null,
      ended: season.endDate != null && season.endDate.getTime() < Date.now(),
      elitePosition: season.elitePosition,
      masterPosition: season.masterPosition,
      lastRecalculationTs: season.lastRecalculationTs,
    },
    seasons: seasonsList,
    results: rows.map((r) => {
      // A reconciled row uses its materialized current identity (a null current
      // clan means the player genuinely left their clan). An unreconciled row
      // falls back to the recorded snapshot.
      const reconciled = r.currentName != null;
      return {
        rank: r.rank,
        account_id: Number(r.accountId),
        nickname: reconciled ? r.currentName! : r.recordedName,
        clan_tag: reconciled ? r.currentClanTag : r.recordedClanTag,
        clan_color: reconciled ? r.currentClanColor : r.recordedClanColor,
        recordedNickname: r.recordedName,
        recordedClanTag: r.recordedClanTag,
        recordedClanColor: r.recordedClanColor,
        rating: r.rating,
        battles: r.battles,
      };
    }),
  };
}

// Batched current-nickname lookup by account_id (WG `account/info`, nickname
// only). Returns an empty map on failure so the caller falls back to the
// recorded names.
async function resolveCurrentNames(
  region: Region,
  accountIds: number[],
): Promise<Map<number, string>> {
  if (accountIds.length === 0) return new Map();
  try {
    const byId = await wg
      .region(region)
      .api.wot.accounts.infoBatch({ accountIds, fields: ["nickname"] });
    const out = new Map<number, string>();
    for (const [id, info] of byId) {
      if (info?.nickname) out.set(id, info.nickname);
    }
    return out;
  } catch {
    return new Map();
  }
}

/**
 * Materialize the current identity of the ranked players and seed name-history.
 * The board records each player's nickname/clan at ranking time; players rename
 * and change clans, so this (a) resolves the CURRENT nickname/clan by account_id
 * and writes them onto the standings (`current_*`), so the board serves them as
 * a pure DB read instead of resolving a few thousand accounts against WG on
 * every request; and (b) for each renamed player, inserts the recorded nickname
 * as a former name, so its old URL redirects to the player and their page lists
 * it (the `_players` rename trigger only captures renames observed after we
 * track someone).
 *
 * Fail-soft (an account we can't resolve keeps its prior stored value, never a
 * guess) and idempotent (name-history dedupes against existing rows), so it is
 * safe to re-run and to run per season. Meant to run in the background (it does
 * the expensive WG resolution once per pass), not on the read path.
 */
export async function reconcileOnslaught(
  region: Region,
): Promise<{ resolved: number; formerNames: number }> {
  const ratings = onslaughtRatingsByRegion[region];
  const seasons = onslaughtSeasonsByRegion[region];
  const history = playerNameHistoryByRegion[region];

  const [season] = await db
    .select()
    .from(seasons)
    .orderBy(desc(seasons.startDate))
    .limit(1);
  if (!season) return { resolved: 0, formerNames: 0 };

  // Freeze this (current) season's codename + rank-art ordinal once, from the
  // client taxonomy's latest season (the client localizes each season as it goes
  // live, so the last one is the current). Stamped only when missing, so a past
  // season keeps the name it had while it was live (the localization resets to
  // the new year once this year archives).
  if (season.codename == null || season.seasonOrdinal == null) {
    const taxonomy = await wg
      .region(region)
      .source.comp7.seasonTaxonomy()
      .catch(() => null);
    const current = taxonomy?.seasons.at(-1) ?? null;
    if (current) {
      await db
        .update(seasons)
        .set({
          codename: season.codename ?? current.name,
          seasonOrdinal: season.seasonOrdinal ?? current.ordinal,
        })
        .where(eq(seasons.eventId, season.eventId));
    }
  }

  const rows = await db
    .select({ accountId: ratings.accountId, name: ratings.name })
    .from(ratings)
    .where(eq(ratings.eventId, season.eventId));
  if (rows.length === 0) return { resolved: 0, formerNames: 0 };

  const accountIds = rows.map((r) => Number(r.accountId));
  const [currentNames, currentClans] = await Promise.all([
    resolveCurrentNames(region, accountIds),
    getPlayerClansBatch(region, accountIds).catch(() => new Map()),
  ]);

  // Materialize the resolved current identity in one bulk UPDATE (unresolved
  // accounts are left untouched, keeping their prior stored value). The payload
  // rides as a single JSON param (`json_to_recordset`) rather than parallel
  // arrays, which drizzle would spread into a row expression.
  const payload = accountIds.flatMap((id) => {
    const nm = currentNames.get(id);
    if (nm == null) return [];
    const clan = currentClans.get(id) ?? null;
    return [
      {
        account_id: id,
        name: nm,
        tag: clan?.tag ?? null,
        color: clan?.color ?? null,
      },
    ];
  });
  if (payload.length > 0) {
    await db.execute(sql`
      UPDATE ${ratings} AS r SET
        current_name = v.name,
        current_clan_tag = v.tag,
        current_clan_color = v.color
      FROM json_to_recordset(${JSON.stringify(payload)}::json)
        AS v(account_id bigint, name text, tag text, color text)
      WHERE r.account_id = v.account_id AND r.event_id = ${season.eventId}
    `);
  }

  // Former-name history: a recorded nickname that differs from the resolved
  // current one is a genuine former name.
  const candidates = rows
    .map((r) => ({ accountId: Number(r.accountId), recorded: r.name }))
    .filter((c) => {
      const current = currentNames.get(c.accountId);
      return current != null && current !== c.recorded;
    });
  let formerNames = 0;
  if (candidates.length > 0) {
    const candAccountIds = [...new Set(candidates.map((c) => c.accountId))];
    const existing = await db
      .select({ accountId: history.accountId, nickname: history.nickname })
      .from(history)
      .where(inArray(history.accountId, candAccountIds));
    const seen = new Set(
      existing.map((e) => `${e.accountId}:${e.nickname.toLowerCase()}`),
    );
    const recordedAt = season.endDate ?? season.startDate ?? undefined;
    const toInsert: { accountId: number; nickname: string; recordedAt?: Date }[] =
      [];
    for (const c of candidates) {
      const key = `${c.accountId}:${c.recorded.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      toInsert.push({
        accountId: c.accountId,
        nickname: c.recorded,
        ...(recordedAt ? { recordedAt } : {}),
      });
    }
    if (toInsert.length > 0) await db.insert(history).values(toInsert);
    formerNames = toInsert.length;
  }

  return { resolved: payload.length, formerNames };
}
