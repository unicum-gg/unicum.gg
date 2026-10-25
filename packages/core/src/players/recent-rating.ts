import { sql, type SQL } from "drizzle-orm";
import { type RatingMetric, wnRatingMetric } from "@unicum.gg/shared";

/**
 * A player's rating over the last 30 days, read off the `*_players` row, for a
 * leaderboard to print beside the lifetime one.
 *
 * The leaderboards rank a career, and a career says nothing about whether the
 * player still plays at that level: a reader asked for the recent figure next
 * to it. The columns are cached on the row by the snapshot pipeline, so this
 * costs the board nothing, but they are only as fresh as the account's last
 * refresh, and the pipeline writes movers only. An account that stopped
 * playing keeps the window it had on its last battle forever, so the value is
 * withheld once that battle is older than the window itself: a player idle for
 * a year must read as having no recent rating, not as last year's.
 *
 * PR and WTR have no value over a window (see `RatingMetric`), so a board
 * ranked by either prints the WNX of those 30 days, and says so.
 *
 * `alias` is the SQL alias the `*_players` table carries in the caller's query.
 */
export function recentRatingSql(metric: RatingMetric, alias = "p"): SQL {
  return sql.raw(
    `CASE WHEN ${alias}.last_battle_at >= now() - interval '30 days' THEN ${alias}."${wnRatingMetric(metric)}_30d" END`,
  );
}

/** The battles behind `recentRatingSql`, withheld on the same condition. */
export function recentBattlesSql(alias = "p"): SQL {
  return sql.raw(
    `CASE WHEN ${alias}.last_battle_at >= now() - interval '30 days' THEN ${alias}.battles_30d END`,
  );
}
