export enum StrongholdTier {
  Advances = "advances",
  T10 = "t10",
  T8 = "t8",
  T6 = "t6",
}

export enum StrongholdSort {
  Rating = "sr",
  RatingBattles = "srb",
  Elo = "elo",
  Battles = "battles",
  Winrate = "winrate",
}

// SRB (battles-based Stronghold Rating): SR reweighted so battle volume rewards
// instead of only gating it, the same idea as HRB vs HR. Computed inline from
// the materialized `sr` + `battles` as `SR · (1 + ln(1 + battles / B0))`, so it
// is always >= SR (volume only adds) and stays on the same absolute scale. A
// single B0 across tiers on purpose: the tiers that are played continuously
// (Skirmish T10) rack up far more battles than the bursty Advances window, so
// they legitimately earn a bigger volume bonus. See `strongholdRatingBattlesColor`.
export const SRB_VOLUME_K = 1000;

// The Overall / last-30-days window the whole leaderboard is computed over
// (SR, battles, win rate all follow it), mirroring the home page's toggle.
export enum StrongholdPeriod {
  Overall = "overall",
  Month = "30d",
}

export const STRONGHOLD_PERIOD_LABEL: Record<StrongholdPeriod, string> = {
  [StrongholdPeriod.Overall]: "Overall",
  [StrongholdPeriod.Month]: "Past 30 days",
};

export const STRONGHOLD_TIER_LABEL: Record<StrongholdTier, string> = {
  [StrongholdTier.Advances]: "Advances",
  [StrongholdTier.T10]: "Skirmish T10",
  [StrongholdTier.T8]: "Skirmish T8",
  [StrongholdTier.T6]: "Skirmish T6",
};

export const STRONGHOLD_SORT_LABEL: Record<StrongholdSort, string> = {
  [StrongholdSort.Rating]: "SR",
  [StrongholdSort.RatingBattles]: "SRB",
  [StrongholdSort.Elo]: "ELO",
  [StrongholdSort.Battles]: "Battles",
  [StrongholdSort.Winrate]: "Win rate",
};

// Eligibility floor to appear on the leaderboard. Single source of truth shared
// by the materialization, the board read filter and the on-page description.
//
// SR is a pure skill rating with no volume brake inside it (that is SRB's job),
// so this floor is what stops a tiny lucky sample from topping the board on an
// elite roster alone. Advances still sits below skirmish: it is only played
// during a Global Map advances window, so clans accumulate battles in bursts a
// few weeks a year rather than continuously, and a skirmish-sized floor ranked
// almost nobody.
export const STRONGHOLD_MIN_BATTLES: Record<StrongholdTier, number> = {
  [StrongholdTier.Advances]: 30,
  [StrongholdTier.T10]: 100,
  [StrongholdTier.T8]: 100,
  [StrongholdTier.T6]: 100,
};

const DEFAULT_SORT_OPTIONS: StrongholdSort[] = [
  StrongholdSort.Rating,
  StrongholdSort.RatingBattles,
  StrongholdSort.Elo,
  StrongholdSort.Battles,
  StrongholdSort.Winrate,
];

export const TIER_SORT_OPTIONS: Record<StrongholdTier, StrongholdSort[]> = {
  [StrongholdTier.T10]: DEFAULT_SORT_OPTIONS,
  [StrongholdTier.T8]: DEFAULT_SORT_OPTIONS,
  [StrongholdTier.T6]: DEFAULT_SORT_OPTIONS,
  [StrongholdTier.Advances]: DEFAULT_SORT_OPTIONS,
};
