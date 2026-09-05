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

// The window the whole leaderboard is computed over (SR, battles, win rate all
// follow it). The same four the player boards offer (TopPlayersPeriod), because
// a clan's recent form deserves the same granularity a player's does.
//
// 24h and 7d were absent for a long time, and the reason was never the rating:
// it was the sampling behind it. Clan snapshots were taken by a portal-bound
// backfill whose full sweep took days, so a "24h" diff would have been measured
// against a baseline a median of NINE days old. The activity cadence in
// `clans/stronghold-policy` (6h for a clan that is playing) is what makes these
// two windows mean what they say.
export enum StrongholdPeriod {
  Day = "24h",
  Week = "7d",
  Month = "30d",
  Overall = "overall",
}

export const STRONGHOLD_PERIOD_LABEL: Record<StrongholdPeriod, string> = {
  [StrongholdPeriod.Day]: "Past 24 hours",
  [StrongholdPeriod.Week]: "Past 7 days",
  [StrongholdPeriod.Month]: "Past 30 days",
  [StrongholdPeriod.Overall]: "Overall",
};

/** How far back each period reaches. `Overall` has no baseline: it reads the
 * running totals rather than a diff. */
export const STRONGHOLD_PERIOD_DAYS: Record<StrongholdPeriod, number | null> = {
  [StrongholdPeriod.Day]: 1,
  [StrongholdPeriod.Week]: 7,
  [StrongholdPeriod.Month]: 30,
  [StrongholdPeriod.Overall]: null,
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

// Eligibility floor to appear on the leaderboard, PER PERIOD. Single source of
// truth shared by the materialization, the board read filter and the on-page
// description.
//
// SR is a pure skill rating with no volume brake inside it (that is SRB's job),
// so this floor is what stops a tiny lucky sample from topping the board on an
// elite roster alone. Advances sits below skirmish throughout: it is only played
// during a Global Map advances window, so clans accumulate battles in bursts a
// few weeks a year rather than continuously, and a skirmish-sized floor ranked
// almost nobody.
//
// Scaled to the window, like the player boards' MIN_BATTLES (20 / 140 / 600 /
// 20000 for 24h / 7d / 30d / overall). This used to be a single number with the
// 30-day board dividing it by three at the call site, which meant the only
// figure written down was the LIFETIME one, and comparing a 24h window against
// a lifetime floor is what made a short-window rating look impossible. No clan
// plays 100 tier-10 skirmishes in a day; the question was never whether they do,
// it was what a day's worth of them is.
//
// The short windows are lifted slightly above strict proportionality on purpose.
// SR's win-rate term is `(wr / 0.5) ^ 1.5`, so on three battles it can only land
// on four values and swings by 5x between them, where a per-battle average like
// WN8 degrades smoothly. A handful of battles is the point where the curve stops
// being lumpy.
export const STRONGHOLD_MIN_BATTLES: Record<
  StrongholdTier,
  Record<StrongholdPeriod, number>
> = {
  [StrongholdTier.Advances]: {
    [StrongholdPeriod.Day]: 3,
    [StrongholdPeriod.Week]: 5,
    [StrongholdPeriod.Month]: 10,
    [StrongholdPeriod.Overall]: 30,
  },
  [StrongholdTier.T10]: {
    [StrongholdPeriod.Day]: 5,
    [StrongholdPeriod.Week]: 12,
    [StrongholdPeriod.Month]: 33,
    [StrongholdPeriod.Overall]: 100,
  },
  [StrongholdTier.T8]: {
    [StrongholdPeriod.Day]: 5,
    [StrongholdPeriod.Week]: 12,
    [StrongholdPeriod.Month]: 33,
    [StrongholdPeriod.Overall]: 100,
  },
  [StrongholdTier.T6]: {
    [StrongholdPeriod.Day]: 5,
    [StrongholdPeriod.Week]: 12,
    [StrongholdPeriod.Month]: 33,
    [StrongholdPeriod.Overall]: 100,
  },
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
