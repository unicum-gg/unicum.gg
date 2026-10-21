/**
 * The sortable columns of the Rampage player leaderboard.
 *
 * Mirrors StrongholdSort: the board is always ranked server-side descending
 * (best first), so picking a column re-fetches that metric's true top-N, it is
 * not a client-side reorder of the loaded page. `Mr` is the canonical default.
 *
 * The board was published as "Steel Hunter" until October 2026, which was a
 * mislabel: it reads `statistics.fallout`, the 2015 Rampage event. See
 * `RatedMode.Rampage`.
 */
export enum RampageSort {
  Mr = "mr",
  Mrb = "mrb",
  Battles = "battles",
  Winrate = "winrate",
  Survival = "survival",
  Damage = "damage",
}

export const RAMPAGE_SORT_LABEL: Record<RampageSort, string> = {
  [RampageSort.Mr]: "MR",
  [RampageSort.Mrb]: "MRB",
  [RampageSort.Battles]: "Battles",
  [RampageSort.Winrate]: "Win rate",
  [RampageSort.Survival]: "Survival",
  [RampageSort.Damage]: "Avg damage",
};

export const DEFAULT_RAMPAGE_SORT = RampageSort.Mr;

export const RAMPAGE_SORT_VALUES: readonly RampageSort[] =
  Object.values(RampageSort);

export function isRampageSort(v: string): v is RampageSort {
  return (RAMPAGE_SORT_VALUES as readonly string[]).includes(v);
}
