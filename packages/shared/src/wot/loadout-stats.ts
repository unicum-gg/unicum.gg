import type { WnRatingMetric } from "../constants/rating";
import { BattleMode } from "./battle-modes";

/**
 * What a whole population has fitted to one vehicle, rolled up from the
 * loadouts their clients sent.
 *
 * The question this answers is the one nothing else can. Wargaming publishes
 * what a tank does and never what anyone put on it, so "which equipment does
 * this vehicle actually want" has only ever been answered by whoever wrote the
 * guide. Here it is counted, and counted separately for the players who do well
 * in it, which is the half that makes it worth reading: the equipment the whole
 * server fits is partly the equipment the whole server owns, and the two
 * answers come apart on exactly the vehicles where the choice matters.
 *
 * ## Every figure here is attached to its sample
 *
 * A share with no count behind it is unreadable, and for a long while these
 * counts will be small: the mod is new, so a tank nobody who runs it owns has
 * no answer at all, and plenty have one or two. So nothing in these types
 * carries a share on its own. A row knows how many loadouts it was counted
 * from, a panel knows how many it was built from, and the reader is told both
 * rather than being handed a percentage that happens to be a third because
 * somebody's single loadout was one of three.
 *
 * ## Battles, never garages
 *
 * Every figure is counted from what was fitted IN A BATTLE, read from that
 * battle's own recording, and the performance beside it is that battle's own
 * result. The garage was the first source and it answered the wrong question:
 * it says what sits on the vehicle today, while the record beside it was earned
 * over years and under whatever the player ran then. Equipment changes with the
 * game (nobody fitted an IS-7 in 2017 the way they do now), so a garage read
 * beside a career is two different eras on one row. A battle has one setup and
 * one outcome, and that pairing is the only one worth publishing. The sample is
 * smaller for it, and it is honest.
 *
 * It is still a correlation. The players who choose a setup bring their own
 * skill to it, which is why every row also carries the same players' figure
 * over all their counted battles in the vehicle: the difference between the two
 * is the part that says something about the setup rather than about who ran it.
  */

/** The four families of fitted item a loadout is counted across. */
export enum LoadoutItemKind {
  /** Optional devices: rammer, vents, vertical stabiliser and the rest. */
  Equipment = "equipment",
  Consumable = "consumable",
  /** Directives, which the client calls battle boosters. */
  Directive = "directive",
  /** One side of one field modification pair, by the catalogue key of the
   * side taken, as the vehicle's post-progression tree names it. */
  FieldMod = "fieldMod",
}

/**
 * The battle modes a vehicle's loadouts are counted in, each one on its own.
 *
 * Never pooled. Every mode carries its own economy and its own idea of a good
 * result: an Onslaught battle is seven against seven with its own ranks, a
 * Skirmish is tier-limited and short, an Advance is a stronghold's own defence.
 * Pooling them would put a damage figure from one beside a win rate from
 * another under one row. So a mode is a view the reader picks, and every figure
 * on the tab belongs to exactly one of them.
 *
 * Only the modes a vehicle's setup is genuinely built for: the event modes
 * (Halloween, Story Mode) are not World of Tanks as anyone fits a vehicle for.
 * The declaration order is the order of the switch.
 */
export enum LoadoutMode {
  Random = "random",
  Onslaught = "onslaught",
  Skirmish = "skirmish",
  Advance = "advance",
}

/** The game's own `bonusType` values each mode is read from. */
export const LOADOUT_MODE_BATTLES: Record<LoadoutMode, readonly BattleMode[]> = {
  [LoadoutMode.Random]: [BattleMode.Random],
  [LoadoutMode.Onslaught]: [BattleMode.Onslaught],
  [LoadoutMode.Skirmish]: [BattleMode.Skirmish],
  [LoadoutMode.Advance]: [BattleMode.Advance],
};

/** Every mode, in the order of the switch. */
export const LOADOUT_MODES = Object.values(LoadoutMode);

/** The mode a `bonusType` is counted under, or null for one that is not. */
export function loadoutModeOf(battleType: number): LoadoutMode | null {
  for (const mode of LOADOUT_MODES) {
    if (LOADOUT_MODE_BATTLES[mode].includes(battleType as BattleMode)) return mode;
  }
  return null;
}

/**
 * How far back a loadout is counted, in days.
 *
 * Equipment is rebalanced and the meta moves, so a setup run a year ago is a
 * fact about a different game. Ninety days is about one major update's
 * lifetime: long enough to keep a quiet vehicle's sample, short enough that an
 * old favourite falls out once nobody runs it.
 */
export const LOADOUT_WINDOW_DAYS = 90;

/**
 * Players a panel needs before its shares are worth reading as shares.
 *
 * Not a gate. Below it the panel still draws, because a reader who installed
 * the mod to see this should see their own vehicle rather than a message, and
 * because the counts are true at any size. What changes is how it is written:
 * under this, the UI leads with "2 of 3" and says the sample is small, over it
 * it leads with the percentage.
 *
 * Twenty is where a third stops being plausibly one person. It is a reading
 * aid, so it is deliberately a round number and not a confidence interval: the
 * honest figure is the count, which is always shown.
 */
export const CONFIDENT_LOADOUT_SAMPLE = 20;

/**
 * Players behind one ROW before its figures are read as being about the setup.
 *
 * Players and not battles. The usage count of a row is meaningful at one, since
 * one player really did run that. A win rate over one player's forty battles is
 * a figure about that player wearing a label that suggests otherwise. The
 * figures are still shown below this, because a table with holes in it is
 * harder to read than one that says plainly which rows rest on almost nobody:
 * the page draws those rows' figures muted and says why on hover.
 */
export const MIN_ROW_PERFORMANCE_SAMPLE = 5;

/** How the battles behind a row went, beside the same players' usual. */
export interface LoadoutPerformance {
  /** Different players among those battles. */
  players: number;
  /** Battles counted. */
  battles: number;
  /** Battles won over battles counted, 0..1. A draw is not a win. */
  winrate: number | null;
  /**
   * The same players' OVERALL win rate, across their whole account, weighted
   * by their battles under this row.
   *
   * The baseline the row is read against. A setup at 53% means one thing from
   * players who win 52% everywhere and another from players who win 56%: the
   * difference says how the setup plays against how good its players are.
   */
  playerWinrate: number | null;
  /** Damage dealt per battle. */
  avgDamage: number | null;
  /** Damage dealt by others on this player's spotting or tracking, per battle. */
  avgAssist: number | null;
  /** Every rating over these battles, with the site's own formulas, so the
   * page shows whichever the reader picked. */
  rating: LoadoutRatings;
  /** The same players' OVERALL ratings, across their whole account, weighted
   * by their battles under this row. What the row's rating is read against: a
   * setup at 2,500 WNX means one thing from 2,000 players and another from
   * 3,000 ones. */
  playerRating: LoadoutRatings;
}

/** One value per rating metric, null where the vehicle has no expected values. */
// A vehicle has no PR or WTR (see `RatingMetric`), so the WN ratings only.
export type LoadoutRatings = Record<WnRatingMetric, number | null>;

/** One fitted item, how many ran it, and how those battles went. */
export interface LoadoutItemUsage {
  kind: LoadoutItemKind;
  /** The catalogue key, which is what resolves to a picture and a name. */
  key: string;
  /** Players who ran it at least once. The figure everything is weighed by. */
  count: number;
  /** Battles it was fitted in. */
  battles: number;
  /** `count` over the panel's players, 0..1. A player who ran two setups
   * counts under both, so a family's shares need not add up to one. */
  share: number;
  performance: LoadoutPerformance;
}

/** One crew skill, under the seat that trained it, and how its battles went. */
export interface CrewSkillUsage {
  /** `commander`, `gunner`, `driver`, `radioman`, `loader`. */
  role: string;
  /** The client's own skill key, e.g. `commander_eagleEye`. */
  skill: string;
  /** Players whose crew had this seat trained in it. */
  count: number;
  /** Battles fought with it. */
  battles: number;
  /** Players whose crew has this seat at all: what `share` is over. */
  crews: number;
  /** `count` over `crews`. A five-man crew and a three-man crew do not both
   * have a loader, so a share taken over everyone would understate every
   * loader skill there is. */
  share: number;
  performance: LoadoutPerformance;
}
/**
 * A complete choice within one family, counted as one thing rather than item by
 * item.
 *
 * Equipment and consumables fill three slots a player decides together, and a
 * field modification tree is five or more pairs decided together, so all three
 * are counted whole: what a reader copies is the set, and three devices each
 * fitted by 60% of players say nothing about whether anybody runs all three.
 * Directives are not: a player picks those one at a time.
 */
export interface PopularSetup {
  /** Which family this combines: equipment, consumables or field mods. */
  kind: LoadoutItemKind;
  /**
   * What is fitted, in the slot order most of its battles used.
   *
   * Recognised as a SET, so the same three are one setup however a player
   * arranged their slots: splitting it by arrangement would turn the most
   * common setup on a vehicle into several thin ones. But it is drawn in the
   * order players actually put them, which is how a reader recognises it (a
   * repair kit, then a first aid kit, then the third), rather than in the
   * alphabetical order of the client's keys.
   */
  items: string[];
  /** Players who ran it at least once. */
  count: number;
  battles: number;
  share: number;
  performance: LoadoutPerformance;
}

/** How much of the rack costs gold, across the counted battles. */
export interface AmmoSummary {
  /** Battles we hold an ammunition layout for. */
  battles: number;
  /** Mean share of rounds bought with gold, 0..1, per battle. */
  premiumShare: number | null;
  /** Mean rounds loaded, which is what the share above is a share of. */
  shellsLoaded: number | null;
}

/**
 * One player's best battle in the vehicle: which battle, and who played it.
 *
 * The best battle of each player rather than the best battles overall, or one
 * player on a good week would fill the list. Only the battle's key travels
 * here: the endpoint draws the battle itself through the same reader as a
 * player's own Battles tab, so the two cannot show one battle differently.
 */
export interface TopBattle {
  /** The battle's own id, which is also its page on the site. */
  arenaUniqueId: string;
  startedAt: Date;
  nickname: string;
  accountId: number;
  /** What the name wears everywhere else on the site: the clan, then the
   * crests. Carried so this list renders a player exactly as the boards do. */
  clanTag: string | null;
  clanColor: string | null;
  isVerified: boolean;
  isSupporter: boolean;
  twitchLogin: string | null;
  tournamentWins: number;
  tournamentFeaturedWins: number;
  tournamentBestTitle: string | null;
  onslaughtBestTier: string | null;
  onslaughtBestRank: number | null;
  onslaughtSeasons: number;
}

/** How many players and battles one mode holds for a vehicle, whoever they
 * are, so the page knows which modes are worth offering before asking. */
export interface LoadoutModeBreakdown {
  mode: LoadoutMode;
  players: number;
  battles: number;
}

/**
 * One of the best players in the vehicle among those whose battles we hold, and
 * what they fit to it.
 *
 * Ranked on their career in the vehicle; the loadout is the one of their latest
 * recorded battle in the mode, never their garage.
 */
export interface TopPlayer {
  nickname: string;
  accountId: number;
  clanTag: string | null;
  clanColor: string | null;
  isVerified: boolean;
  isSupporter: boolean;
  twitchLogin: string | null;
  tournamentWins: number;
  tournamentFeaturedWins: number;
  tournamentBestTitle: string | null;
  onslaughtBestTier: string | null;
  onslaughtBestRank: number | null;
  onslaughtSeasons: number;
  /** Their whole record in the vehicle, which is what they are ranked on. */
  battles: number;
  winrate: number | null;
  avgDamage: number | null;
  rating: LoadoutRatings;
  /** The battle the loadout below was read from. */
  loadoutBattle: { arenaUniqueId: string; startedAt: Date };
  /** By slot, a free slot as null: what was left free is part of the build. */
  equipment: (string | null)[];
  directives: (string | null)[];
  consumables: (string | null)[];
  /** Every pair of the vehicle's tree, in tree order: the catalogue key of the
   * side taken, or null for a pair not taken. Empty only for a vehicle with
   * no tree. */
  fieldMods: (string | null)[];
  /** Each seat and its skills, in the order they were learned. */
  crew: { role: string; skills: string[] }[];
  shells: { name: string; type: string; premium: boolean; count: number }[];
}

/** Everything one vehicle's Loadouts tab draws. */
export interface TankLoadoutStats {
  tankId: number;
  /** The battle mode every figure below was counted in. */
  mode: LoadoutMode;
  /** Every mode's own sample for this vehicle, whichever mode was asked for. */
  modes: LoadoutModeBreakdown[];
  /** Players in this mode. Every `share` on this object is over it. */
  sample: number;
  /** Their battles, which the performance figures are counted over. */
  battles: number;
  items: LoadoutItemUsage[];
  crewSkills: CrewSkillUsage[];
  setups: PopularSetup[];
  ammo: AmmoSummary;
  topPlayers: TopPlayer[];
  topBattles: TopBattle[];
  /** Newest battle counted, so the page can say how current this is. */
  updatedAt: Date | null;
}

/** Whether a sample is large enough for its shares to lead the writing. Below
 * this the UI says "2 of 3" instead of "67%", which is the same fact told the
 * way it can actually be read. */
export function isConfidentSample(sample: number): boolean {
  return sample >= CONFIDENT_LOADOUT_SAMPLE;
}

/** The items of one family, which is how every panel slices `items`. */
export function itemsOfKind(
  items: LoadoutItemUsage[],
  kind: LoadoutItemKind,
): LoadoutItemUsage[] {
  return items.filter((item) => item.kind === kind);
}
