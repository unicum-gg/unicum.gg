/**
 * Leaderboard time window. Kept in its own dependency-free module so it can be
 * imported (e.g. by the OpenAPI schemas) without pulling in the DB-heavy
 * leaderboard logic from `./index.ts`.
 */
export enum TopPlayersPeriod {
  Day = "24h",
  Week = "7d",
  Month = "30d",
  Overall = "overall",
}
