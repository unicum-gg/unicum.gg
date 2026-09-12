/**
 * What a filtered list holds, as the key its search placeholder is written
 * under in `components/filter-bar`.
 *
 * A key rather than the noun itself, because the placeholder is a whole
 * sentence per subject: "Search among 1,236 tanks" only reads that way in
 * English, and a language that inflects the number or the noun needs to write
 * the line rather than receive its two halves.
 */
export enum FilterSubject {
  Tanks = "tanks",
  RatedTanks = "rated-tanks",
  Videos = "videos",
  Players = "players",
  Clans = "clans",
  Tournaments = "tournaments",
  Teams = "teams",
}
