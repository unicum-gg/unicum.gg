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
  SteelHunter = "steel-hunter",
  Onslaught = "onslaught",
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
  [PlayerMode.SteelHunter]: "Steel Hunter",
  [PlayerMode.Onslaught]: "Onslaught",
};
