// Account-valuation model: what the player's garage would cost to rebuild.
//
//   - Rebuild value : reconstruction cost through the official store (research
//     XP + credits + gold of every non-reward tank), in the region currency.
//
// It used to carry a second figure beside it, a resale estimate modelled on
// grey-market listings. That one is gone and must not come back: selling a
// Wargaming account is against the game's terms of service, so publishing a
// price for one reads as helping that market along, and it priced an account
// mostly on its owner's global rating, which is the player rather than the
// garage. What a garage costs at the official store is the question the store
// itself answers, so it is the one left here.
//
// What it is priced FROM depends on whether the account has ever signed in
// here, and the two readings are different enough that the figure carries the
// answer (`verifiedAt`) rather than leaving the page to guess.
//
// Unverified, the input is `buildPlayerTankRows`, which keeps a row per vehicle
// the account has BATTLES in, because that is all Wargaming publishes to a
// stranger: `in_garage` comes back null on every row, so a vehicle sold years
// ago is indistinguishable from one still held, and a vehicle bought and never
// driven is invisible. Measured on a 185-vehicle account, 60 of those rows were
// already sold, so this reading is not a floor in either direction. The page
// says so beside the figure.
//
// Verified, the account's own access token has answered, `*_player_garage`
// holds what it reported, and the figure prices exactly what is in the garage:
// the sold vehicles drop out and the never-driven ones come in. That is the
// only reading worth the word "value", which is why signing in is what the page
// offers in place of an apology.
//
// Pure and client-safe: computed server-side for the API/SDK (so the bot and
// external consumers get it too), and the constants stay tunable in one place.

import type { Region } from "@unicum.gg/wargaming";
import { CREDITS_PER_GOLD, XP_PER_GOLD, goldToMoney } from "../shop";
import type { PlayerTankRow } from "./tanks";

/**
 * One line of the rebuild cost: the vehicles it pays for, the amount in the
 * game currency it is actually paid in, that amount at the game's own exchange
 * rate in gold, and what the store charges for that gold.
 *
 * `count` is per line rather than per vehicle class, because the two tech-tree
 * lines do not cover the same tanks: a tier I is free (no research, no credit
 * price) and a handful of vehicles are owned without ever having been
 * researched, so "306 tech-tree tanks" is the wrong number for both.
 */
export type RebuildLine = {
  count: number;
  /** Free XP, credits or gold, per the line. */
  units: number;
  /** `units` at the game's own rate. Gold converts to itself. */
  gold: number;
  /** Store price of this line's gold, summed vehicle by vehicle. */
  amount: number;
};

/**
 * How the total is reached. The three lines sum to it EXACTLY, because each
 * accumulates the very same per-vehicle store price the total does: a breakdown
 * that did its own arithmetic would contradict the figure it explains.
 *
 * That also decides a question the non-linear price makes real. Gold gets
 * cheaper in bulk, so pricing each vehicle separately and pricing the whole
 * garage in one purchase are different numbers (measured on a 517-tank garage:
 * 18,900 EUR against 17,237, a 9.6% spread). Per vehicle is the honest one,
 * because a single purchase of this size cannot be made: the NA store caps an
 * "any amount" gold order at 25,000, and this garage needs five million.
 */
export type RebuildBreakdown = {
  /** What the three lines come to in gold, the figure the store is asked for. */
  gold: number;
  research: RebuildLine;
  credits: RebuildLine;
  premiums: RebuildLine;
};

export type AccountValue = {
  amount: number;
  currency: string;
  /**
   * When the garage this was priced from was confirmed by its owner's own
   * token, or null when it was not.
   *
   * It is the difference between a figure and an estimate, so it travels with
   * the figure rather than beside it: unverified, the vehicles priced here are
   * the ones the account has ever DRIVEN, which on a measured account was a
   * third more than it still holds, and the page has to say so.
   */
  verifiedAt?: string | null;
  // Optional for the reason `markProgress` is on the payload above: a response
  // cached under the previous shape (the detail cache is a 60s TTL, so at most
  // one minute of them) carries the total with no lines under it, and reads as
  // absent rather than crashing the panel.
  breakdown?: RebuildBreakdown;
} | null;

/** Which currency a vehicle's purchase is billed in. */
export enum RebuildCurrency {
  Credits = "credits",
  Gold = "gold",
}

/** One vehicle's share of the rebuild cost: what the store charges for it, and
 * the game currency behind each half. */
export type VehicleRebuildCost = {
  /** Store price of the free XP that researching it would take. Zero for a
   * premium, which is not researched. */
  research: number;
  /** Store price of buying it: credits for a tech-tree tank, gold for a premium. */
  purchase: number;
  total: number;
  /** Free XP converted to gold. */
  researchGold: number;
  /** The purchase in gold, whichever currency it is billed in. */
  purchaseGold: number;
  purchaseCurrency: RebuildCurrency;
};

/**
 * What one vehicle adds to the rebuild cost, or null when it adds nothing: a
 * reward tank carries no shop price (its `buyGold` is a restore placeholder),
 * and a region may have no store pricing table at all.
 *
 * "No shop price" is not "free". A reward tank often costs real money, through
 * an auction, a paid Battle Pass or any of the other events Wargaming runs, but
 * at whatever it asks each time rather than at a published tariff, so there is
 * no figure to add here and pricing one would be inventing it.
 *
 * The per-vehicle calculation lives here, alone, because two things read it:
 * the total below, and the table that lists every vehicle under it. A table
 * doing its own arithmetic would be free to disagree with the figure it
 * breaks down, and nothing would catch it.
 */
export function vehicleRebuildCost(
  v: PlayerTankRow,
  region: Region,
): VehicleRebuildCost | null {
  if (v.isReward) return null;
  if (!goldToMoney(region, 0)) return null;
  const priceOf = (gold: number) => goldToMoney(region, gold)?.amount ?? 0;
  if (v.isPremium) {
    if (!v.buyGold) return null;
    const purchase = priceOf(v.buyGold);
    return {
      research: 0,
      purchase,
      total: purchase,
      researchGold: 0,
      purchaseGold: v.buyGold,
      purchaseCurrency: RebuildCurrency.Gold,
    };
  }
  const researchGold = v.researchXp ? v.researchXp / XP_PER_GOLD : 0;
  const purchaseGold = v.buyCredits ? v.buyCredits / CREDITS_PER_GOLD : 0;
  if (!researchGold && !purchaseGold) return null;
  const research = researchGold ? priceOf(researchGold) : 0;
  const purchase = purchaseGold ? priceOf(purchaseGold) : 0;
  return {
    research,
    purchase,
    total: research + purchase,
    researchGold,
    purchaseGold,
    purchaseCurrency: RebuildCurrency.Credits,
  };
}

function emptyLine(): RebuildLine {
  return { count: 0, units: 0, gold: 0, amount: 0 };
}

function addToLine(line: RebuildLine, units: number, gold: number, amount: number) {
  line.count += 1;
  line.units += units;
  line.gold += gold;
  line.amount += amount;
}

/**
 * Reconstruction cost of the garage through the official store, in the region
 * store currency: each non-reward tank's gold price (premiums) or research XP +
 * credits price (tech-tree), converted to money. Reward tanks are excluded: the
 * shop never prices them (their `buyGold` is a restore placeholder), so what
 * one cost its owner is known only to the event it came from.
 * Returns null for a region with no store pricing table.
 */
export function computeAccountValue(
  vehicles: PlayerTankRow[],
  region: Region,
  verifiedAt?: Date | null,
): AccountValue {
  const probe = goldToMoney(region, 0);
  if (!probe) return null;
  const research = emptyLine();
  const credits = emptyLine();
  const premiums = emptyLine();
  let total = 0;
  for (const v of vehicles) {
    // `false` is the only value that excludes a vehicle, and it only exists on
    // a verified garage. Null means nobody has read this account's garage, so
    // the vehicle is priced the way it always was: dropping it instead would
    // empty the figure for everyone who has never signed in.
    if (v.owned === false) continue;
    const cost = vehicleRebuildCost(v, region);
    if (!cost) continue;
    if (cost.purchaseCurrency === RebuildCurrency.Gold) {
      addToLine(premiums, cost.purchaseGold, cost.purchaseGold, cost.purchase);
    } else {
      if (cost.researchGold)
        addToLine(research, v.researchXp ?? 0, cost.researchGold, cost.research);
      if (cost.purchaseGold)
        addToLine(credits, v.buyCredits ?? 0, cost.purchaseGold, cost.purchase);
    }
    total += cost.total;
  }
  return {
    amount: total,
    currency: probe.currency,
    verifiedAt: verifiedAt ? verifiedAt.toISOString() : null,
    breakdown: {
      gold: research.gold + credits.gold + premiums.gold,
      research,
      credits,
      premiums,
    },
  };
}

/** The account figures carried in the player detail payload. */
export type PlayerValuation = {
  account: AccountValue;
};

export function computePlayerValuation(
  vehicles: PlayerTankRow[],
  region: Region,
  verifiedAt?: Date | null,
): PlayerValuation {
  return { account: computeAccountValue(vehicles, region, verifiedAt) };
}
