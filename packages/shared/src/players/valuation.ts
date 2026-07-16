// Account-valuation model: two figures derived from a player's garage.
//
//   - Account value : reconstruction cost through the official store (research
//     XP + credits + gold of every non-reward tank), in the region currency.
//   - Market value  : what a comparable account trades for. Dominated by three
//     factors, calibrated from a scrape of ~2000 live grey-market listings:
//     reward tanks, player skill (WN8, gated by battle count), and marks.
//
// Pure and client-safe: computed server-side for the API/SDK (so the bot and
// external consumers get it too), and the constants stay tunable in one place.

import type { Region } from "@unicum.gg/wargaming";
import { CREDITS_PER_GOLD, XP_PER_GOLD, goldToMoney } from "../shop";
import type { PlayerVehicleRow } from "./vehicles";

// --- Market-model weights (indicative money units in the region currency; the
// account-trading market is global and priced similarly across servers). ---

// Reward tanks by tier: the single biggest driver of a high-value account. All
// reward tanks of the same tier are weighted the same.
export const REWARD_VALUE_BY_TIER: Record<number, number> = {
  1: 5,
  2: 5,
  3: 5,
  4: 8,
  5: 10,
  6: 15,
  7: 25,
  8: 40,
  9: 80,
  10: 150,
  11: 350,
};
export const REWARD_VALUE_DEFAULT = 40;

// Marks of Excellence, weighted by tier (3 marks on a tier X is far harder, and
// worth far more, than on a tier V). Kept modest so it doesn't double-count the
// skill signal already captured by the WN8 multiplier.
export const MARK3_VALUE_PER_TIER = 2.5;
export const MARK2_VALUE_PER_TIER = 0.6;

// Garage floor: base account access plus a small per-tank contribution for the
// tech-tree grind, which the market barely prices.
export const MARKET_BASE = 15;
export const TIER_X_VALUE = 2.5;

// Premium tanks by tier: a tier VIII (Skorpion, Bourrasque, the credit farmers)
// is worth far more than a low-tier premium, but all stay well below the reward
// table since a premium is store-purchasable, not earned. Reward tanks that are
// also flagged premium are valued via REWARD_VALUE_BY_TIER only, never here.
export const PREMIUM_VALUE_BY_TIER: Record<number, number> = {
  1: 0.2,
  2: 0.2,
  3: 0.2,
  4: 0.2,
  5: 0.3,
  6: 0.4,
  7: 0.6,
  8: 1,
  9: 1.5,
  10: 2.5,
  11: 4,
};
export const PREMIUM_VALUE_DEFAULT = 0.6;

// Skill multiplier from WN8. Pivots at 1.0 for an average 1600 WN8.
export const WN8_MULT_PIVOT = 1600;
export const WN8_MULT_SLOPE = 1 / 1400; // +1.0 multiplier per +1400 WN8
export const WN8_MULT_MIN = 0.6;
// No upper cap: WN8 naturally tops out around ~5000 (only the very best), so the
// multiplier is effectively bounded to ~×3.4 in practice. Letting it scale keeps
// genuine super-unicum accounts credible (a fully-maxed, heavily 3-marked
// account lands in the tens of thousands, matching "ultra statist" listings).
export const WN8_MULT_MAX = Number.POSITIVE_INFINITY;

// The skill multiplier only counts once the stats are proven: a WN8 3000 over
// 50 battles means nothing. Confidence ramps linearly to full at this many
// battles, pulling the multiplier back toward neutral (1.0) below it.
export const STATS_CONFIDENCE_BATTLES = 10000;

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** WN8 skill multiplier, before the battle-confidence gate. */
export function wn8Multiplier(wn8: number): number {
  return clamp(
    1 + (wn8 - WN8_MULT_PIVOT) * WN8_MULT_SLOPE,
    WN8_MULT_MIN,
    WN8_MULT_MAX,
  );
}

/** Per-tier contribution of a group (reward tanks, N-mark tanks), for tooltips
 * that spell out the calculation. Sorted highest tier first. */
export type TierContribution = {
  tier: number;
  count: number;
  /** Per-unit weight at this tier. */
  unit: number;
  /** count × unit. */
  value: number;
};

export type MarketValueBreakdown = {
  amount: number;
  base: number;
  tierX: number;
  premiums: number;
  rewards: number;
  marks: number;
  subtotal: number;
  statMultiplier: number;
  statConfidence: number;
  rewardCount: number;
  tierXCount: number;
  premiumCount: number;
  mark3Count: number;
  // Inputs + per-tier detail, so the UI can show the calculation on hover.
  wn8: number | null;
  battles: number;
  rewardsByTier: TierContribution[];
  premiumsByTier: TierContribution[];
  marks3ByTier: TierContribution[];
  marks2ByTier: TierContribution[];
};

function toTierContributions(
  counts: Map<number, number>,
  unitOf: (tier: number) => number,
): TierContribution[] {
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([tier, count]) => {
      const unit = unitOf(tier);
      return { tier, count, unit, value: count * unit };
    });
}

/**
 * Estimated grey-market value of the account. A small garage floor plus reward
 * tanks (by tier) and marks (by tier), scaled by a WN8 skill multiplier that
 * only counts once proven over enough battles.
 */
export function computeMarketValue(
  vehicles: PlayerVehicleRow[],
  wn8: number | null,
  battles: number,
): MarketValueBreakdown {
  let tierXCount = 0;
  let premiumCount = 0;
  let rewardCount = 0;
  let mark3Count = 0;
  let rewards = 0;
  let premiums = 0;
  let marks = 0;
  const rewardTierCounts = new Map<number, number>();
  const premiumTierCounts = new Map<number, number>();
  const mark3TierCounts = new Map<number, number>();
  const mark2TierCounts = new Map<number, number>();
  const bump = (m: Map<number, number>, k: number) =>
    m.set(k, (m.get(k) ?? 0) + 1);

  for (const v of vehicles) {
    const tier = v.tier ?? 0;
    if (tier === 10) tierXCount += 1;
    if (v.isReward) {
      rewardCount += 1;
      rewards += REWARD_VALUE_BY_TIER[tier] ?? REWARD_VALUE_DEFAULT;
      bump(rewardTierCounts, tier);
    } else if (v.isPremium) {
      // Reward tanks are excluded (valued via the reward table above) so a
      // premium reward isn't counted twice.
      premiumCount += 1;
      premiums += PREMIUM_VALUE_BY_TIER[tier] ?? PREMIUM_VALUE_DEFAULT;
      bump(premiumTierCounts, tier);
    }
    if (v.moe === 3) {
      mark3Count += 1;
      marks += MARK3_VALUE_PER_TIER * tier;
      bump(mark3TierCounts, tier);
    } else if (v.moe === 2) {
      marks += MARK2_VALUE_PER_TIER * tier;
      bump(mark2TierCounts, tier);
    }
  }

  const base = MARKET_BASE;
  const tierX = tierXCount * TIER_X_VALUE;
  const subtotal = base + tierX + premiums + rewards + marks;

  const confidence = clamp(battles / STATS_CONFIDENCE_BATTLES, 0, 1);
  const rawMult = wn8 != null ? wn8Multiplier(wn8) : 1;
  // Pull the multiplier toward neutral (1.0) until the stats are proven.
  const statMultiplier = 1 + (rawMult - 1) * confidence;

  return {
    amount: subtotal * statMultiplier,
    base,
    tierX,
    premiums,
    rewards,
    marks,
    subtotal,
    statMultiplier,
    statConfidence: confidence,
    rewardCount,
    tierXCount,
    premiumCount,
    mark3Count,
    wn8,
    battles,
    rewardsByTier: toTierContributions(
      rewardTierCounts,
      (t) => REWARD_VALUE_BY_TIER[t] ?? REWARD_VALUE_DEFAULT,
    ),
    premiumsByTier: toTierContributions(
      premiumTierCounts,
      (t) => PREMIUM_VALUE_BY_TIER[t] ?? PREMIUM_VALUE_DEFAULT,
    ),
    marks3ByTier: toTierContributions(
      mark3TierCounts,
      (t) => MARK3_VALUE_PER_TIER * t,
    ),
    marks2ByTier: toTierContributions(
      mark2TierCounts,
      (t) => MARK2_VALUE_PER_TIER * t,
    ),
  };
}

export type AccountValue = { amount: number; currency: string } | null;

/**
 * Reconstruction cost of the garage through the official store, in the region
 * store currency: each non-reward tank's gold price (premiums) or research XP +
 * credits price (tech-tree), converted to money. Reward tanks are excluded:
 * they aren't store-purchasable (their `buyGold` is a restore placeholder).
 * Returns null for a region with no store pricing table.
 */
export function computeAccountValue(
  vehicles: PlayerVehicleRow[],
  region: Region,
): AccountValue {
  const probe = goldToMoney(region, 0);
  if (!probe) return null;
  let total = 0;
  for (const v of vehicles) {
    if (v.isReward) continue;
    if (v.isPremium) {
      if (v.buyGold) total += goldToMoney(region, v.buyGold)?.amount ?? 0;
    } else {
      if (v.researchXp)
        total += goldToMoney(region, v.researchXp / XP_PER_GOLD)?.amount ?? 0;
      if (v.buyCredits)
        total += goldToMoney(region, v.buyCredits / CREDITS_PER_GOLD)?.amount ?? 0;
    }
  }
  return { amount: total, currency: probe.currency };
}

/** Both account figures, as carried in the player detail payload. */
export type PlayerValuation = {
  market: MarketValueBreakdown;
  account: AccountValue;
};

export function computePlayerValuation(
  vehicles: PlayerVehicleRow[],
  wn8: number | null,
  battles: number,
  region: Region,
): PlayerValuation {
  return {
    market: computeMarketValue(vehicles, wn8, battles),
    account: computeAccountValue(vehicles, region),
  };
}
