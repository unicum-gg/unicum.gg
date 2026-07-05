/**
 * Periods the clan leaderboard is ranked over. Unlike players (which also have
 * 24h / 7d), clans only expose the lifetime ranking and a 30-day "recent form"
 * ranking, so this is its own enum rather than a reuse of TopPlayersPeriod.
 */
export enum TopClansPeriod {
  Overall = "overall",
  Month = "30d",
}
