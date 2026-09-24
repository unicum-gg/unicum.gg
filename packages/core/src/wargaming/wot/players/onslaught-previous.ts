import { sql } from "drizzle-orm";
import {
  onslaughtRatingsByRegion,
  onslaughtSeasonsByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import type { Region } from "@unicum.gg/wargaming";

/**
 * How the season before this one ended.
 *
 * It is the only thing we hold that says where a season FINISHES, and that is a
 * different question from anything the live board can answer. The current
 * season's own figures are all mid-flight: the field is still filling up, the
 * Legend bar is still climbing, and every player's battle count is still going
 * up. A reader looking at them has no idea whether they are near the end state
 * or a third of the way to it, and neither does a projection, which is a fit
 * rather than a fact.
 *
 * What survives of a settled season is its final standings, and nothing else:
 * the feeder began capturing after the last one ended, so there is no curve, no
 * daily fold and therefore no arrival cost for it. The four figures below are
 * all the table itself can answer, and each is the finished twin of a figure
 * the live panels already show.
 *
 * The comparison that holds is end-to-end. EU's board carried 4138 players when
 * it settled and carries 1463 today, so a median taken now is over the early,
 * heavy players and a median taken then is over everyone, late arrivals
 * included. The panels say which is which rather than inviting the reader to
 * read one as progress towards the other.
 */
export type OnslaughtPreviousSeason = {
  eventId: string;
  /** The season's own name, frozen in English while it was live. */
  codename: string | null;
  /**
   * The ordinal the client releases a season under, and ONLY when this season
   * belongs to the same year as the one being rendered.
   *
   * The ordinal names a season inside a year and nothing more, while the
   * catalogue that resolves it into the reader's language is regenerated from
   * the live client and therefore only ever describes the current year. Hand a
   * reader the ordinal of a season from the year before and they are told the
   * name of a completely different season: "third" resolved to "Season of the
   * Jade Phoenix" for the Jade DRAGON, which is the season before it and a year
   * apart. Null here means the caller falls back to the codename, which is the
   * English the season was actually released under.
   */
  seasonOrdinal: string | null;
  startDate: string | null;
  endDate: string | null;
  /** Players holding a place when it settled, which is what the current
   * season's count is heading towards and the reason its bar climbs. */
  ranked: number;
  /** What Legend cost at the end. */
  legendPoints: number | null;
  /** What the board's floor was, which is Champion's threshold. */
  championPoints: number | null;
  /** Battles the holders of each rank had played over the WHOLE season, as a
   * median: what a finished season actually costs. */
  legendBattles: number | null;
  championBattles: number | null;
};

/**
 * The newest season that started before `startedAt`, with its end state.
 *
 * Relative to the season being rendered rather than to today, so a reader who
 * has selected a past season is shown the one before THAT, which is the
 * comparison that means anything on the page they are looking at.
 *
 * One pass over the standings: five figures out of the same scan, since asking
 * for them one at a time re-read the 4138 rows five times and cost 141ms
 * against 19.
 */
export async function getPreviousOnslaughtSeason(
  region: Region,
  current: { startDate: Date | string | null; yearId: string | null },
): Promise<OnslaughtPreviousSeason | null> {
  const startedAt = current.startDate;
  if (startedAt == null) return null;
  const seasons = onslaughtSeasonsByRegion[region];
  const ratings = onslaughtRatingsByRegion[region];
  const from = startedAt instanceof Date ? startedAt : new Date(startedAt);

  const [previous] = await db
    .select()
    .from(seasons)
    .where(sql`${seasons.startDate} < ${from.toISOString()}`)
    .orderBy(sql`${seasons.startDate} DESC NULLS LAST`)
    .limit(1);
  if (!previous) return null;

  const rows = await db.execute<{
    ranked: number;
    champion_points: number | null;
    legend_points: number | null;
    legend_battles: string | number | null;
    champion_battles: string | number | null;
  }>(sql`
    SELECT count(*)::int AS ranked,
           min(rating) AS champion_points,
           -- The rating held at the last Legend position, which is what the
           -- rank cost. The season row's own elite_points is the same figure
           -- when the reconcile stamped one, and this is readable either way.
           max(rating) FILTER (WHERE rank = ${previous.elitePosition}) AS legend_points,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY battles)
             FILTER (WHERE rank <= ${previous.elitePosition}) AS legend_battles,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY battles)
             FILTER (WHERE rank > ${previous.elitePosition}) AS champion_battles
    FROM ${ratings}
    WHERE event_id = ${previous.eventId}
  `);
  const row = rows[0];
  if (!row || row.ranked === 0) return null;

  const number = (value: string | number | null): number | null =>
    value == null ? null : Math.round(Number(value));

  return {
    eventId: previous.eventId,
    codename: previous.codename,
    // Only when both seasons are stamped with the same year, since that is what
    // makes the ordinal resolvable against the current catalogue. Either one
    // unstamped is an unknown rather than a match.
    seasonOrdinal:
      current.yearId != null && previous.yearId === current.yearId
        ? previous.seasonOrdinal
        : null,
    startDate: previous.startDate?.toISOString() ?? null,
    endDate: previous.endDate?.toISOString() ?? null,
    ranked: row.ranked,
    legendPoints: number(row.legend_points) ?? previous.elitePoints,
    championPoints: number(row.champion_points),
    legendBattles: number(row.legend_battles),
    championBattles: number(row.champion_battles),
  };
}
