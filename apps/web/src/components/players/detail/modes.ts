// The profile's battle modes and the game's own English name for each.
//
// Its own module, importing nothing, because two very different readers need
// it: the nav (through `tabs.ts`) and `scripts/generate-game-vocabulary`, which
// runs outside the app and must not pull `ROUTES` and the env validation behind
// it just to read ten words.
export enum PlayerMode {
  Overall = "overall",
  Skirmish = "skirmish",
  Advances = "advances",
  GrandBattles = "grand",
  RankedBattles = "ranked",
  ClanWarsX = "cw-x",
  ClanWarsVIII = "cw-viii",
  ClanWarsVI = "cw-vi",
  Onslaught = "onslaught",
  /**
   * The 2015 Rampage event, which WG's API carries as `statistics.fallout` and
   * which this tab was published as "Steel Hunter" until October 2026. They are
   * two different modes: Rampage ran from update 9.10 (September 2015) to 9.15
   * (May 2016) on ordinary tier VIII to X vehicles, and its two battle types
   * were Domination and "Steel Hunt", one letter from the name it was given
   * here. Steel Hunter is the battle royale on eight dedicated vehicles, and
   * Wargaming publishes no statistics for it anywhere. See `RatedMode.Rampage`.
   *
   * **Last of the modes offered to everybody, and the order is the point.** It
   * ended in May 2016, so it belongs after the ones still being played and
   * right against the archived block below, which is what it is in all but
   * name: it is only shown to every account rather than to those who played it
   * because, unlike those five, its record has always been read here. This
   * order drives the profile's tab row, the nav cards and the board tabs, which
   * all read `PLAYER_MODE_LABEL`.
   */
  Rampage = "rampage",
  // Modes nobody can play any more, whose record `account/info` still answers
  // and the profile never read. Offered only to the accounts that played them;
  // see `PLAYER_ARCHIVED_MODES` and `availablePlayerModes`.
  ClanBattles = "clan",
  TankCompany = "company",
  TeamBattles = "team",
  PermanentTeams = "permanent-teams",
  Historical = "historical",
}

/**
 * The English name of each battle mode, which is Wargaming's own.
 *
 * A map of its own so the vocabulary generator can read it beside the shared
 * ones: these are the game's words, and every language the game is published in
 * has its own for them (`Onslaught` is `Offensive` to a French player). The nav
 * renders `game/vocabulary`, not this.
 */
export const PLAYER_MODE_LABEL: Record<PlayerMode, string> = {
  [PlayerMode.Overall]: "Random Battles",
  [PlayerMode.Skirmish]: "Skirmish",
  [PlayerMode.Advances]: "Advances",
  [PlayerMode.GrandBattles]: "Grand Battles",
  [PlayerMode.RankedBattles]: "Ranked Battles",
  [PlayerMode.ClanWarsX]: "Clan Wars X",
  [PlayerMode.ClanWarsVIII]: "Clan Wars VIII",
  [PlayerMode.ClanWarsVI]: "Clan Wars VI",
  [PlayerMode.Onslaught]: "Onslaught",
  [PlayerMode.Rampage]: "Rampage",
  // The same strings `TANK_BATTLE_MODE_LABEL` gives the per-vehicle blocks:
  // one mode seen from two sides must not meet a reader under two words.
  [PlayerMode.ClanBattles]: "Clan Battles",
  [PlayerMode.TankCompany]: "Tank Company",
  [PlayerMode.TeamBattles]: "Team Battles",
  [PlayerMode.PermanentTeams]: "Permanent Teams",
  [PlayerMode.Historical]: "Historical Battles",
};
