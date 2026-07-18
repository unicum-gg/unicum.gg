// Account-valuation model: two figures derived from a player's garage + account.
//
//   - Rebuild value : reconstruction cost through the official store (research
//     XP + credits + gold of every non-reward tank), in the region currency.
//   - Market value  : what a comparable account trades for on the grey market,
//     calibrated against live listings (eldorado). The price is driven mostly by
//     SKILL/DEPTH (WG global rating + battle count), with the garage itself only
//     a small floor: even a stacked farmed account (Object 279 + reward tanks +
//     70 tier X) trades for a few dozen euros, while an elite account is worth
//     thousands for the account itself. A content-only model can't span that, so
//     skill/depth is the driver here, not the tank collection.
//
// Pure and client-safe: computed server-side for the API/SDK (so the bot and
// external consumers get it too), and the constants stay tunable in one place.

import type { Region } from "@unicum.gg/wargaming";
import { CREDITS_PER_GOLD, XP_PER_GOLD, goldToMoney } from "../shop";
import type { PlayerVehicleRow } from "./vehicles";

// --- Content floor (money units, region currency): the garage baseline. Kept
// small on purpose. Live listings compress even a fully-loaded garage into a few
// dozen euros, so these weights are a floor, never the main driver. ---

// Reward tanks by tier. All reward tanks of a tier weigh the same (the market
// barely distinguishes an ultra-rare campaign tank from a mode-grind one).
export const REWARD_FLOOR_BY_TIER: Record<number, number> = {
  8: 0.8,
  9: 1.5,
  10: 2.5,
  11: 4,
};
export const REWARD_FLOOR_DEFAULT = 2;

export const TIERX_FLOOR = 0.25;

export const PREMIUM_FLOOR_BY_TIER: Record<number, number> = {
  8: 0.25,
  9: 0.35,
  10: 0.5,
  11: 0.8,
};
export const PREMIUM_FLOOR_DEFAULT = 0.15;

// Marks of Excellence, weighted by tier (a 3-mark on a tier X is far harder than
// on a tier V). Small: the skill they signal is already priced by the WGR term.
export const MARK3_FLOOR_PER_TIER = 0.12;
export const MARK2_FLOOR_PER_TIER = 0.03;

// --- Skill/depth premium: the real driver of account price. WG's global rating
// (WGR / "Personal Rating", the figure grey-market listings quote) blends skill,
// activity and battle count into one number. Zero below an average account,
// superlinear above, so only genuinely strong accounts command real value. ---
export const WGR_PREMIUM_FLOOR = 5000;
// Very steep on purpose: a top-of-server account (~12.5k WGR) is drastically
// rarer, and worth far more, than the "good" accounts that actually get listed
// (~9.5k WGR). Tuned so ~9.5k WGR lands ~€2.4k (the legit for-sale band) while a
// genuine top unicum (~11.5-12.7k) lands ~€8.5k-15k, above every real listing.
export const WGR_PREMIUM_EXP = 3.3;
export const WGR_PREMIUM_COEF = 2.2e-9;

// Extreme-veteran depth bonus: a huge battle count is a mega-account in itself,
// regardless of the garage. Only kicks in above the pivot.
export const BATTLES_DEPTH_PIVOT = 20000;
export const BATTLES_DEPTH_PER_1K = 100;

// No artificial ceiling: the value is driven by the WG global rating, which is
// itself bounded (no player exceeds ~13-15k), so the top is naturally limited
// without a cap that would otherwise flatten the very best accounts together.

/** WGR skill/depth premium (money units): the dominant term for strong accounts. */
export function wgrPremium(wgr: number): number {
  return (
    WGR_PREMIUM_COEF *
    Math.pow(Math.max(0, wgr - WGR_PREMIUM_FLOOR), WGR_PREMIUM_EXP)
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
  /** Garage floor: rewards + tierX + premiums + marks. */
  content: number;
  tierX: number;
  premiums: number;
  rewards: number;
  marks: number;
  /** Skill/depth premium from the WG global rating. */
  skillPremium: number;
  /** Extra value from an exceptional battle count. */
  depthBonus: number;
  rewardCount: number;
  tierXCount: number;
  premiumCount: number;
  mark3Count: number;
  // Inputs + per-tier detail, so the UI can show the calculation on hover.
  wgr: number;
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
 * Estimated grey-market value of the account: a small garage floor (reward tanks
 * + marks + tier X + premiums, all cheap) plus the two real drivers (a skill
 * premium from the WG global rating and a depth bonus for an exceptional battle
 * count), capped at the top mega-account level.
 */
export function computeMarketValue(
  vehicles: PlayerVehicleRow[],
  wgr: number,
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
      rewards += REWARD_FLOOR_BY_TIER[tier] ?? REWARD_FLOOR_DEFAULT;
      bump(rewardTierCounts, tier);
    } else if (v.isPremium) {
      // Reward tanks are excluded (valued via the reward table above) so a
      // premium reward isn't counted twice.
      premiumCount += 1;
      premiums += PREMIUM_FLOOR_BY_TIER[tier] ?? PREMIUM_FLOOR_DEFAULT;
      bump(premiumTierCounts, tier);
    }
    if (v.moe === 3) {
      mark3Count += 1;
      marks += MARK3_FLOOR_PER_TIER * tier;
      bump(mark3TierCounts, tier);
    } else if (v.moe === 2) {
      marks += MARK2_FLOOR_PER_TIER * tier;
      bump(mark2TierCounts, tier);
    }
  }

  const tierX = tierXCount * TIERX_FLOOR;
  const content = tierX + premiums + rewards + marks;
  const skillPremium = wgrPremium(wgr);
  const depthBonus =
    Math.max(0, (battles - BATTLES_DEPTH_PIVOT) / 1000) * BATTLES_DEPTH_PER_1K;
  const amount = Math.max(0, content + skillPremium + depthBonus);

  return {
    amount,
    content,
    tierX,
    premiums,
    rewards,
    marks,
    skillPremium,
    depthBonus,
    rewardCount,
    tierXCount,
    premiumCount,
    mark3Count,
    wgr,
    battles,
    rewardsByTier: toTierContributions(
      rewardTierCounts,
      (t) => REWARD_FLOOR_BY_TIER[t] ?? REWARD_FLOOR_DEFAULT,
    ),
    premiumsByTier: toTierContributions(
      premiumTierCounts,
      (t) => PREMIUM_FLOOR_BY_TIER[t] ?? PREMIUM_FLOOR_DEFAULT,
    ),
    marks3ByTier: toTierContributions(
      mark3TierCounts,
      (t) => MARK3_FLOOR_PER_TIER * t,
    ),
    marks2ByTier: toTierContributions(
      mark2TierCounts,
      (t) => MARK2_FLOOR_PER_TIER * t,
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
  wgr: number,
  battles: number,
  region: Region,
): PlayerValuation {
  return {
    market: computeMarketValue(vehicles, wgr, battles),
    account: computeAccountValue(vehicles, region),
  };
}
