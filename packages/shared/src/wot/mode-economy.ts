import type { Region } from "@unicum.gg/wargaming";
import { modeLabel } from "./battle-modes";
import { LOADOUT_WINDOW_DAYS, loadoutModeOf, type LoadoutMode } from "./loadout-stats";

/**
 * What each battle mode pays, tier by tier, read from the recorded battles.
 *
 * Wargaming publishes no credits per mode for anybody: an account's statistics
 * carry experience per mode and never a credit. Every figure here exists
 * because the unicum.gg mod uploads each battle its player fights, and the
 * public half of those results carries what the battle earned EVERY one of the
 * thirty participants, not just the uploader. So the sample grows by whole
 * teams, which is what makes a per-mode comparison publishable this early.
 *
 * ## Two economies, and only one of them is everybody's
 *
 * The thirty public figures are the battle's own credits, before the premium
 * account, the reserves, the missions and every cost: exactly the uploader's
 * `creditsBase` (checked row for row against it). That is the figure to compare
 * modes on, since nothing about the player's account or wallet leaks into it.
 *
 * The rest of the economy (the premium multiplier, the bonuses, the repair,
 * ammunition and consumable bills) exists for the uploader alone, so the "net"
 * columns are a far smaller sample: the mod's own players, one record per
 * battle. They are carried with their own counts and the page only reads them
 * once `MODE_ECONOMY_MIN_NET_PLAYERS` people stand behind them.
 *
 * ## Per minute, because a mode is also a pace
 *
 * An Onslaught battle lasts half a random one, so per battle and per minute
 * rank the modes differently, and the second is the one a player farming
 * credits actually lives by. The minute is the battle's own length, not the
 * player's time alive: leaving after a death is a habit, not the mode.
 *
 * ## Compared at one tier
 *
 * A vehicle earns by its tier, and the modes do not share one: Onslaught is
 * played at the top tiers only, a random battle at all of them. Pooling the
 * tiers would rank Onslaught first simply because nobody plays it at tier V,
 * so every row belongs to one (mode, tier) and the page compares modes inside
 * a tier.
 *
 * The client-safe shapes. The aggregate and its storage live in core
 * (`battles/mode-economy`), rebuilt hourly so no page ever scans the battles.
 */

/** How far back the battles are counted, in days: the loadouts' own window,
 * for the same reason (one major update's lifetime, so a rebalanced economy
 * falls out of the figures once its battles do). */
export const MODE_ECONOMY_WINDOW_DAYS = LOADOUT_WINDOW_DAYS;

/**
 * Mod players a net figure needs before the page reads it.
 *
 * The net carries one player's habits whole (premium account, gold shells,
 * reserves), so five people firing different ammunition is the least that says
 * something about the mode rather than about one of them. A reading aid, not a
 * confidence interval, like the loadouts' own thresholds.
 */
export const MODE_ECONOMY_MIN_NET_PLAYERS = 5;

/**
 * Vehicle records a (mode, tier) row needs before it is shown at all.
 *
 * Below it the row is a handful of battles, and a mean over a handful of
 * credits figures is mostly whoever top-scored in them.
 */
export const MODE_ECONOMY_MIN_RECORDS = 50;

/** One mode at one tier. */
export type ModeEconomyRow = {
  mode: LoadoutMode;
  tier: number;
  /** Battles counted. */
  battles: number;
  /** Vehicle records: one account's part in one battle, bots excluded. */
  records: number;
  /** Different accounts among them. */
  players: number;
  /** Base credits per record: the battle's own, before premium and costs. */
  creditsPerBattle: number;
  /** Base credits per minute of battle. */
  creditsPerMinute: number;
  /** Experience per record, the battle's own like the credits. */
  xpPerBattle: number;
  xpPerMinute: number;
  /** Mean battle length, in seconds. */
  avgDuration: number;
  /** Share of records on the winning side, 0..1. */
  winrate: number;
  /** The mod players' own sample: records and accounts. */
  netRecords: number;
  netPlayers: number;
  /** What a mod player earned per battle, premium and bonuses included,
   * before the bills. Null with no record. */
  grossPerBattle: number | null;
  /** Repair, ammunition and consumables per battle. Null with no record. */
  costsPerBattle: number | null;
  /** `grossPerBattle - costsPerBattle`. Null with no record. */
  netPerBattle: number | null;
};

export type ModeEconomy = {
  region: Region;
  windowDays: number;
  rows: ModeEconomyRow[];
  computedAt: Date | null;
};

/**
 * One player's own economy in one mode at one tier: the battles they uploaded
 * themselves, the only ones whose results carry their wallet.
 *
 * Where the region's table above needs several mod players before it reads a
 * net figure, this one wants exactly one: it answers "which mode pays ME",
 * premium account, gold shells and all, and those habits are the answer here
 * rather than noise in it.
 */
export type PlayerModeEconomyRow = {
  /** The game's `bonusType` the row is named after. Variants the game names
   * alike (the three Random Battle economies) are folded into one row. */
  battleType: number;
  /** The vehicle's tier, or 0 for a vehicle the catalogue does not hold: the
   * event vehicles (Halloween's) exist only inside their event. */
  tier: number;
  battles: number;
  /** Share of them won, 0..1. */
  winrate: number;
  /** Mean battle length, in seconds. */
  avgDuration: number;
  /** Mean time the player stayed alive, in seconds: the battle's length when
   * they survived it. */
  avgLifetime: number;
  /** Everything earned per battle, premium and bonuses included, before the bills. */
  grossPerBattle: number;
  repairPerBattle: number;
  /** The credits half of the ammunition bill (gold spent on shells is not in it). */
  ammoPerBattle: number;
  suppliesPerBattle: number;
  /** `grossPerBattle` less the three bills: what landed in the account. */
  netPerBattle: number;
  /** The same per minute of battle: the pace for a player who sees every
   * battle out. */
  netPerMinute: number;
  /** The same per minute alive: the pace for a player who leaves for the next
   * battle as soon as they are destroyed, since the rest of the battle pays
   * them nothing more and costs them nothing either. */
  netPerMinuteAlive: number;
  /** Share of those battles played with a premium account, 0..1. */
  premiumShare: number;
};

export type PlayerModeEconomy = {
  accountId: number;
  windowDays: number;
  rows: PlayerModeEconomyRow[];
  /** The player keeps their battle list, and this with it, to themselves. */
  hidden?: boolean;
};

/** Battles a player's (mode, tier) row needs before its figures are read as
 * more than an anecdote; thinner rows are still shown, faded. */
export const PLAYER_MODE_ECONOMY_MIN_BATTLES = 5;

/**
 * What a player's battle is counted under on their own profit panel: one of
 * the four modes the region compares, else the name the game gives the mode.
 *
 * Every mode counts here, events included, since the question is what each
 * mode paid THIS player; only the region's table needs modes comparable
 * between players. Keyed on the name so the game's variants of one mode (the
 * Random Battle economies) are one row rather than three rows named alike.
 */
export function playerEconomyModeKey(battleType: number): string {
  return loadoutModeOf(battleType) ?? modeLabel(battleType) ?? `type-${battleType}`;
}
