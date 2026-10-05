/**
 * The game's own `bonusType`, which is what a battle's results call its mode.
 *
 * Taken from the client's `ARENA_BONUS_TYPE` (`res/scripts/common/constants.py`)
 * rather than invented, because that is the number a battle actually carries
 * and the one the mod sends unchanged. The names are the game's own: a player
 * reading "Onslaught" has seen that word on the mode's own button, where
 * "comp7" is the token the client files it under.
 *
 * Not every member of the enum is here. The ones left out are the ones a
 * player's own battles never carry (bootstrap and bootcamp modes, the client's
 * internal training arenas), and `modeLabel` answers null for them rather than
 * inventing a name: an unlabelled battle still has a map, a vehicle and a
 * rating, and a wrong label would be worse than none.
 */
export enum BattleMode {
  Random = 1,
  Training = 2,
  Tournament = 4,
  ClanBattle = 5,
  CyberSport = 7,
  Event = 9,
  GlobalMap = 13,
  TournamentRegular = 14,
  TournamentClan = 15,
  /** Skirmishes: the stronghold sortie. */
  Skirmish = 20,
  /** Advances: the stronghold's own defence and attack battles. */
  Advance = 21,
  Ranked = 22,
  /** A random battle on the Epic (Frontline) economy. */
  EpicRandom = 24,
  Event2 = 26,
  Frontline = 27,
  SteelHunterSolo = 29,
  SteelHunterSquad = 30,
  TournamentEvent = 31,
  Bob = 32,
  EventRandom = 33,
  WeekendBrawl = 36,
  Mapbox = 37,
  MapsTraining = 38,
  Onslaught = 43,
  Winback = 44,
  RandomNp2 = 46,
  TournamentOnslaught = 47,
  OnslaughtLight = 49,
  StoryMode = 104,
}

/** How the game names each mode, in its own words. */
export const BATTLE_MODE_LABEL: Record<BattleMode, string> = {
  [BattleMode.Random]: "Random Battle",
  [BattleMode.Training]: "Training",
  [BattleMode.Tournament]: "Tournament",
  [BattleMode.ClanBattle]: "Clan Battle",
  [BattleMode.CyberSport]: "Clan Battle",
  [BattleMode.Event]: "Special Event",
  [BattleMode.GlobalMap]: "Clan Wars",
  [BattleMode.TournamentRegular]: "Tournament",
  [BattleMode.TournamentClan]: "Tournament",
  [BattleMode.Skirmish]: "Skirmish",
  [BattleMode.Advance]: "Advance",
  [BattleMode.Ranked]: "Ranked Battle",
  [BattleMode.EpicRandom]: "Random Battle",
  [BattleMode.Event2]: "Special Event",
  [BattleMode.Frontline]: "Frontline",
  [BattleMode.SteelHunterSolo]: "Steel Hunter",
  [BattleMode.SteelHunterSquad]: "Steel Hunter",
  [BattleMode.TournamentEvent]: "Tournament",
  [BattleMode.Bob]: "Special Event",
  [BattleMode.EventRandom]: "Special Event",
  [BattleMode.WeekendBrawl]: "Weekend Brawl",
  [BattleMode.Mapbox]: "Mapbox",
  [BattleMode.MapsTraining]: "Maps Training",
  [BattleMode.Onslaught]: "Onslaught",
  [BattleMode.Winback]: "Winback",
  [BattleMode.RandomNp2]: "Random Battle",
  [BattleMode.TournamentOnslaught]: "Tournament",
  [BattleMode.OnslaughtLight]: "Onslaught",
  [BattleMode.StoryMode]: "Story Mode",
};

/**
 * What a `bonusType` is called, or null for one we have no name for.
 *
 * Null rather than a humanized number: a battle whose mode we cannot name
 * still has a map, a vehicle and a rating, and "Bonus type 51" on a player's
 * page would be the site showing its own plumbing.
 */
export function modeLabel(bonusType: number): string | null {
  return BATTLE_MODE_LABEL[bonusType as BattleMode] ?? null;
}

/**
 * The gameplay a battle was played under, as the client names it.
 *
 * The mode says which queue it came from; this says what the teams were doing
 * in it, and the two are independent: a random battle is `ctf`, `domination`
 * or `assault` depending on the arena's own layout. Shown beside the mode only
 * when it adds something, which is why `comp7` is absent here: it is Onslaught
 * saying Onslaught twice.
 */
export const GAMEPLAY_LABEL: Record<string, string> = {
  ctf: "Standard Battle",
  domination: "Encounter",
  assault: "Assault",
  assault2: "Assault",
  nations: "Confrontation",
  ctf2: "Standard Battle",
  domination2: "Encounter",
  bootcamp: "Bootcamp",
  fallout: "Steel Hunter",
  epic: "Frontline",
  maps_training: "Maps Training",
};

/** What a gameplay is called, or null when it says nothing the mode has not. */
export function gameplayLabel(gameplay: string | null): string | null {
  if (!gameplay) return null;
  return GAMEPLAY_LABEL[gameplay] ?? null;
}
