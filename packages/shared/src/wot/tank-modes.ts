/**
 * The battle modes Wargaming reports a vehicle's record in, and what each one
 * is.
 *
 * `wot/tanks/stats/` answers a block per mode beside the `all` block the rest
 * of the site is built on, and the keys are Wargaming's own. They are kept as
 * the enum's values so the column, the query parameter and the API payload all
 * speak the same word the upstream does, the way `MapGameMode` keeps the
 * client's own tokens.
 *
 * `ranked_battles` is deliberately absent. It is a documented extra, but
 * Wargaming's own reference marks it "Warning. The field will be disabled.",
 * and it answers null for every vehicle of every account measured (85 accounts,
 * 60 of them a random sample of the ones we track, 25 picked for having played
 * in the last two days). The live ranked block is `ranked_10x10`, which the
 * reference itself calls an archive.
 */
export enum TankBattleMode {
  /** `all` minus the two below it, so the mode the overall figure is mostly
   * made of. An extra, unlike the rest of `all`'s parts. */
  Random = "random",
  /** The pre-Stronghold Clan Wars battles. Part of `all`. */
  Clan = "clan",
  /** Tank Company battles, retired in 2015. Part of `all`. */
  Company = "company",
  /** Global Map. Equals the three Clan Wars tiers the profile splits the
   * account-level figure into, which per vehicle arrive summed. */
  GlobalMap = "globalmap",
  /** Stronghold Skirmishes. */
  Skirmish = "stronghold_skirmish",
  /** What Wargaming's reference calls Stronghold defense and the game calls
   * Advances, which is the name the profile's own tab already uses. */
  Advances = "stronghold_defense",
  /** Grand Battles, the 30v30 format. */
  GrandBattles = "epic",
  /** Ranked Battles in the 10v10 format. Wargaming's reference calls this an
   * archive, so it stops where that format did. */
  Ranked = "ranked_10x10",
  /** Team Battles, the 7/54 ladder retired in 2017. */
  TeamBattles = "team",
  /** "Battle statistics of permanent teams", the ladder's unranked sibling. */
  PermanentTeams = "regular_team",
  /**
   * Rampage, the event that ran from update 9.10 (September 2015) to 9.15 (May
   * 2016). `fallout` is Wargaming's internal token for it, which their API
   * reference labels "Fallout statistics".
   *
   * **NOT Steel Hunter**, although the site published it under that name until
   * October 2026. The 184,627 per-vehicle rows carrying these battles sit on
   * ordinary tier VIII to X tanks (Bat.-Châtillon 25 t leads with 182,872
   * battles), and the eight dedicated Steel Hunter vehicles carry ZERO rows
   * here or in any other mode: Wargaming publishes no Steel Hunter statistics
   * at all. The trap had one more turn in it, which is how the mislabel
   * happened: Rampage's own headline battle type was called "Steel Hunt".
   *
   * See `TANK_MODES_MULTI_VEHICLE` and `RatedMode.Rampage`.
   */
  Fallout = "fallout",
}

/**
 * The game's own English name for each mode, which is Wargaming's.
 *
 * Taken from their API reference's own descriptions rather than invented: their
 * `clan` block is "Clan battles statistics", `company` is "Tank Company battles
 * statistics", `regular_team` is "Battle statistics of permanent teams" and
 * `stronghold_defense` is "Stronghold defense", which the game itself calls
 * Advances and which is the name the profile's own tab already uses.
 *
 * This is the whole set, for the places that need a name without a translator
 * (the bot's tables, the SDK's consumers, the OpenAPI descriptions). What
 * reaches a READER goes through `tankModeName`, because four of these eleven
 * names are already catalogued under another family and a name must have one
 * rendering per language, not two. See `TANK_MODE_VOCABULARY_KEY`.
 */
export const TANK_BATTLE_MODE_LABEL: Record<TankBattleMode, string> = {
  [TankBattleMode.Random]: "Random Battles",
  [TankBattleMode.Clan]: "Clan Battles",
  [TankBattleMode.Company]: "Tank Company",
  [TankBattleMode.GlobalMap]: "Global Map",
  [TankBattleMode.Skirmish]: "Skirmish",
  [TankBattleMode.Advances]: "Advances",
  [TankBattleMode.GrandBattles]: "Grand Battles",
  [TankBattleMode.Ranked]: "Ranked Battles 10x10",
  [TankBattleMode.TeamBattles]: "Team Battles",
  [TankBattleMode.PermanentTeams]: "Permanent Teams",
  [TankBattleMode.Fallout]: "Rampage",
};

/**
 * Where each mode's name lives in `game/vocabulary`.
 *
 * Four of them are names the catalogue already carries, under the family that
 * needed them first: the profile's mode tabs name Advances and Grand Battles,
 * and Skirmish and Random Battles are named three times over between the
 * features, the clan modes and those tabs. Copying them into a `tank-modes`
 * family of their own would be eleven more strings for a model to translate
 * independently, and a name the catalogue renders two ways holds nothing to
 * either: the locale suite drops it from enforcement and reports it, which is
 * exactly the failure the vocabulary rule exists to prevent. So the family
 * carries only the seven names nothing else had, and the other four are read
 * where they already are.
 *
 * Nothing reads these paths directly; `tankModeName` resolves them.
 */
export const TANK_MODE_VOCABULARY_KEY: Record<TankBattleMode, string> = {
  [TankBattleMode.Random]: "clan-modes.random",
  [TankBattleMode.Skirmish]: "features.skirmish",
  [TankBattleMode.Advances]: "player-modes.advances",
  [TankBattleMode.GrandBattles]: "player-modes.grand",
  // The five the profile now names too, since it grew a tab for each: one mode
  // seen from two sides reads from one entry.
  [TankBattleMode.Clan]: "player-modes.clan",
  [TankBattleMode.Company]: "player-modes.company",
  [TankBattleMode.TeamBattles]: "player-modes.team",
  [TankBattleMode.PermanentTeams]: "player-modes.permanent-teams",
  // `fallout` joined them with the Rampage rename. It had an entry of its own
  // only because the profile called the same block Steel Hunter, which was a
  // mislabel this must not borrow; both sides name the mode Rampage now, so the
  // reason is gone and a second entry would be one more cell to keep in
  // agreement for no gain.
  [TankBattleMode.Fallout]: "player-modes.rampage",
  // The two with nothing to borrow. `globalmap` has no account-level twin (the
  // profile splits it into three Clan Wars tiers), and `ranked_10x10` is the
  // retired 10v10 where the profile's Ranked tab is the current format.
  [TankBattleMode.GlobalMap]: "tank-modes.globalmap",
  [TankBattleMode.Ranked]: "tank-modes.ranked_10x10",
};

/**
 * The `tank-modes` family itself: the names no other family had.
 *
 * Derived from the two maps above rather than written a third time, so a mode
 * whose key moves cannot leave a stale entry behind.
 */
export const TANK_MODE_VOCABULARY: Record<string, string> = Object.fromEntries(
  (Object.keys(TANK_MODE_VOCABULARY_KEY) as TankBattleMode[])
    .filter((mode) => TANK_MODE_VOCABULARY_KEY[mode].startsWith("tank-modes."))
    .map((mode) => [
      TANK_MODE_VOCABULARY_KEY[mode].slice("tank-modes.".length),
      TANK_BATTLE_MODE_LABEL[mode],
    ]),
);

/**
 * The mode a vehicle's record is read in unless another is picked.
 *
 * Random Battles, not the overall block, and the game is the reason: there is
 * no "overall" mode to queue for, and `all` is only Random plus two ladders
 * retired a decade ago that most accounts never played. A default nobody can
 * play is a concept the reader has to learn before the breakdown means
 * anything.
 */
export const DEFAULT_TANK_BATTLE_MODE = TankBattleMode.Random;

/**
 * Every mode, in the order they are offered.
 *
 * The three that make up `all` lead, since the overall figure every other page
 * shows is exactly their sum (verified across 797 vehicle rows and 18 counters,
 * zero mismatches). Then the modes played today, then the retired ones, which
 * are last because they are an archive rather than a choice: a player's Tank
 * Company record is a decade old and survives nowhere else.
 */
export const TANK_BATTLE_MODES: TankBattleMode[] = [
  TankBattleMode.Random,
  TankBattleMode.Clan,
  TankBattleMode.Company,
  TankBattleMode.Skirmish,
  TankBattleMode.Advances,
  TankBattleMode.GlobalMap,
  TankBattleMode.GrandBattles,
  TankBattleMode.Ranked,
  TankBattleMode.TeamBattles,
  TankBattleMode.PermanentTeams,
  TankBattleMode.Fallout,
];

/**
 * The modes `all` is the sum of.
 *
 * Which is why `random` needs no column of its own: it is `all` less these two,
 * and deriving it keeps the three from ever disagreeing with the figure the
 * rest of the site already shows.
 */
export const TANK_MODES_IN_OVERALL: TankBattleMode[] = [
  TankBattleMode.Clan,
  TankBattleMode.Company,
];

/** Every mode but Random, which is the set that is fetched and stored. */
export type StoredTankBattleMode = Exclude<TankBattleMode, TankBattleMode.Random>;

/**
 * The modes a row is kept for.
 *
 * Random is absent and derived instead, which is a storage decision: a row for
 * it would be one per (player, vehicle) pair we track, around 290 million on EU
 * alone, against the 74 million these ten come to between them. See
 * `makeTankModesTable`.
 */
export const TANK_MODES_STORED: StoredTankBattleMode[] = TANK_BATTLE_MODES.filter(
  (mode): mode is StoredTankBattleMode => mode !== TankBattleMode.Random,
);

/**
 * Modes where one battle is counted against several vehicles, so their per-
 * vehicle battles must never be summed into a mode total.
 *
 * Fallout fielded a lineup with respawns, so a battle lands on every vehicle it
 * was fought in: measured against the account's own figure, the per-vehicle sum
 * runs 1.6x to 2.6x over (896 against 380 on one account, 26,380 against 10,128
 * on the heaviest one we track). Every other mode reconciles to the battle.
 */
export const TANK_MODES_MULTI_VEHICLE: TankBattleMode[] = [
  TankBattleMode.Fallout,
];

/**
 * The modes a WN rating means anything in.
 *
 * Random Battles, and only it. WN7, WN8 and WNX are all built against expected
 * values measured on random battles: an expected damage per vehicle, and a win
 * rate anchored at 50%. Neither holds anywhere else. A Stronghold Skirmish is
 * shorter and tier-limited, so the damage a good player does is a fraction of
 * their random-battle average, while the win rate of anyone who plays it
 * seriously sits near 90%. Read off that block the rating asks "did you do
 * random-battle damage" in a format where nobody can, and answers with a number
 * that looks like a verdict: on one vehicle measured here, 1 794 WNX in
 * Skirmish against 4 708 in Random, at an 89.5% win rate against 71.9%.
 *
 * So the ratings are not computed for the other modes at all, and the column
 * that shows them is dropped rather than dashed. The overall record keeps
 * them: `all` is Random plus two ladders retired a decade ago, which is what
 * every rating on the site has always been read from.
 */
export const TANK_MODES_RATED: TankBattleMode[] = [TankBattleMode.Random];

const RATED = new Set<TankBattleMode>(TANK_MODES_RATED);

/** Whether a WN rating read off this mode's block says anything. */
export function isRatedTankMode(mode: TankBattleMode): boolean {
  return RATED.has(mode);
}

/** Modes no longer played, whose record only ever shrinks as accounts lapse. */
export const TANK_MODES_RETIRED: TankBattleMode[] = [
  TankBattleMode.Clan,
  TankBattleMode.Company,
  TankBattleMode.Ranked,
  TankBattleMode.TeamBattles,
  TankBattleMode.PermanentTeams,
  TankBattleMode.Fallout,
];

const MODE_VALUES = new Set<string>(TANK_BATTLE_MODES);

/** The mode a string names, or null when it names none of them. */
export function tankBattleMode(value: string | null | undefined): TankBattleMode | null {
  return value != null && MODE_VALUES.has(value) ? (value as TankBattleMode) : null;
}
