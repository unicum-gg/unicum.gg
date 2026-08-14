// The sortable columns of the Steel Hunter (battle-royale) player leaderboard.
// Mirrors StrongholdSort: the board is always ranked server-side descending
// (best first), so picking a column re-fetches that metric's true top-N, it is
// not a client-side reorder of the loaded page. `Hr` is the canonical default.
export enum SteelHunterSort {
  Hr = "hr",
  Hrb = "hrb",
  Battles = "battles",
  Winrate = "winrate",
  Survival = "survival",
  Damage = "damage",
}

export const STEEL_HUNTER_SORT_LABEL: Record<SteelHunterSort, string> = {
  [SteelHunterSort.Hr]: "HR",
  [SteelHunterSort.Hrb]: "HRB",
  [SteelHunterSort.Battles]: "Battles",
  [SteelHunterSort.Winrate]: "Win rate",
  [SteelHunterSort.Survival]: "Survival",
  [SteelHunterSort.Damage]: "Avg damage",
};

export const DEFAULT_STEEL_HUNTER_SORT = SteelHunterSort.Hr;

export const STEEL_HUNTER_SORT_VALUES: readonly SteelHunterSort[] =
  Object.values(SteelHunterSort);

export function isSteelHunterSort(v: string): v is SteelHunterSort {
  return (STEEL_HUNTER_SORT_VALUES as readonly string[]).includes(v);
}
