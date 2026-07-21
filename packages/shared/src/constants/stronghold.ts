export enum StrongholdTier {
  Advances = "advances",
  T10 = "t10",
  T8 = "t8",
  T6 = "t6",
}

export enum StrongholdSort {
  Elo = "elo",
  Battles = "battles",
  Battles30d = "battles30d",
  Winrate30d = "winrate30d",
  Winrate = "winrate",
}

export const STRONGHOLD_TIER_LABEL: Record<StrongholdTier, string> = {
  [StrongholdTier.Advances]: "Advances",
  [StrongholdTier.T10]: "Skirmish T10",
  [StrongholdTier.T8]: "Skirmish T8",
  [StrongholdTier.T6]: "Skirmish T6",
};

export const STRONGHOLD_SORT_LABEL: Record<StrongholdSort, string> = {
  [StrongholdSort.Elo]: "ELO",
  [StrongholdSort.Battles]: "Battles",
  [StrongholdSort.Battles30d]: "30d battles",
  [StrongholdSort.Winrate30d]: "30d win rate",
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

export const TIER_SORT_OPTIONS: Record<StrongholdTier, StrongholdSort[]> = {
  [StrongholdTier.T10]: [
    StrongholdSort.Elo,
    StrongholdSort.Battles,
    StrongholdSort.Battles30d,
    StrongholdSort.Winrate30d,
    StrongholdSort.Winrate,
  ],
  [StrongholdTier.T8]: [
    StrongholdSort.Elo,
    StrongholdSort.Battles,
    StrongholdSort.Battles30d,
    StrongholdSort.Winrate30d,
    StrongholdSort.Winrate,
  ],
  [StrongholdTier.T6]: [
    StrongholdSort.Elo,
    StrongholdSort.Battles,
    StrongholdSort.Battles30d,
    StrongholdSort.Winrate30d,
    StrongholdSort.Winrate,
  ],
  [StrongholdTier.Advances]: [
    StrongholdSort.Elo,
    StrongholdSort.Battles,
    StrongholdSort.Battles30d,
    StrongholdSort.Winrate30d,
    StrongholdSort.Winrate,
  ],
};
