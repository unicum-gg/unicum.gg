/**
 * The battle modes an ACCOUNT's record still carries and nobody can play any
 * more.
 *
 * `account/info` answers a block per mode, and five of them had no home: the
 * pre-Stronghold Clan Battles, Tank Company, the Team Battles ladder and its
 * unranked sibling, and Historical Battles. All five come back on every call we
 * already make, without being asked for as an `extra`, and all five carry the
 * same shape as the modes the profile already shows. They were simply never
 * read.
 *
 * The values are Wargaming's own block names, like `TankBattleMode`, so the
 * column, the route segment and the API payload all speak the upstream's word.
 *
 * Kept apart from the live modes rather than folded in with them, because what
 * makes them different is not that they are old: **their totals cannot change
 * again**. That is what lets them be stored as one row per player instead of a
 * column set repeated on every snapshot, and it is why their 24h/7d/30d columns
 * are structurally empty rather than merely unknown. See
 * `makePlayerArchivedModesTable`.
 */
export enum PlayerArchivedMode {
  /** Clan Battles as they were before Strongholds, retired 2014. */
  Clan = "clan",
  /** Tank Company battles, retired 2015. */
  Company = "company",
  /** The Team Battles 7/54 ladder, retired 2017. */
  TeamBattles = "team",
  /** Wargaming's "battle statistics of permanent teams", the ladder's unranked
   * sibling. */
  PermanentTeams = "regular_team",
  /** Historical Battles, the 2013 period-accurate lineup mode. */
  Historical = "historical",
}

/** In the order they are offered, which is the order they were retired in. */
export const PLAYER_ARCHIVED_MODES: PlayerArchivedMode[] = [
  PlayerArchivedMode.Clan,
  PlayerArchivedMode.Company,
  PlayerArchivedMode.TeamBattles,
  PlayerArchivedMode.PermanentTeams,
  PlayerArchivedMode.Historical,
];

const VALUES = new Set<string>(PLAYER_ARCHIVED_MODES);

/** The mode a stored string names, or null when it names none of them. */
export function playerArchivedMode(
  value: string | null | undefined,
): PlayerArchivedMode | null {
  return value != null && VALUES.has(value)
    ? (value as PlayerArchivedMode)
    : null;
}
