export enum StrongholdTier {
  Advances = "advances",
  T10 = "t10",
  T8 = "t8",
  T6 = "t6",
}

export enum StrongholdSort {
  Rating = "sr",
  Elo = "elo",
  Battles = "battles",
  Winrate = "winrate",
}

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
  [StrongholdSort.Elo]: "ELO",
  [StrongholdSort.Battles]: "Battles",
  [StrongholdSort.Winrate]: "Win rate",
};

// Eligibility floor to appear on the leaderboard. Advances (15v15) demands
// more history to rank than skirmish (7v7). Single source of truth shared
// by the query filter and the on-page description.
export const STRONGHOLD_MIN_BATTLES: Record<StrongholdTier, number> = {
  [StrongholdTier.Advances]: 100,
  [StrongholdTier.T10]: 50,
  [StrongholdTier.T8]: 50,
  [StrongholdTier.T6]: 50,
};

const DEFAULT_SORT_OPTIONS: StrongholdSort[] = [
  StrongholdSort.Rating,
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
