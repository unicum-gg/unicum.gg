/**
 * A page of the site a term points at. Targets are named rather than spelled
 * as paths because every catalogue route carries the reader's region: the entry
 * says "the tank specifications table", the front resolves it to `/na/tanks`
 * for a reader on NA. Keeping the region out of the content also means a term
 * is written once and links correctly on all three servers.
 */
export enum GlossaryLinkTarget {
  TopPlayers = "top-players",
  TopClans = "top-clans",
  Tanks = "tanks",
  TankEconomics = "tank-economics",
  MarksOfExcellence = "marks-of-excellence",
  MarksOfMastery = "marks-of-mastery",
  TankChanges = "tank-changes",
  Maps = "maps",
  Stronghold = "stronghold",
  Advances = "advances",
  Onslaught = "onslaught",
  SteelHunter = "steel-hunter",
  Coverage = "coverage",
  Docs = "docs",
  /** One vehicle, by catalogue slug (`is-7`). */
  Tank = "tank",
  /** One map, by catalogue slug (`prokhorovka`). */
  Map = "map",
}

export type GlossaryLink = {
  target: GlossaryLinkTarget;
  /** Required by `Tank` and `Map`, ignored by every other target. */
  slug?: string;
  /** Overrides the target's default wording when the sentence needs it. */
  label?: string;
};
