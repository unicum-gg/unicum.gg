import type { PlayerTankRow } from "@unicum.gg/shared";
import {
  PLAYER_COLUMN_BY_KEY,
  type PlayerSortCtx,
} from "@/components/players/detail/tanks/vehicle-columns";
import { SortDirection, type SortState } from "@/components/tanks/sortable-head";

const TYPE_ABBR: Record<string, string> = {
  heavyTank: "HT",
  mediumTank: "MT",
  lightTank: "LT",
  "AT-SPG": "TD",
  SPG: "SPG",
};

function sortValue(
  row: PlayerTankRow,
  key: string,
  ctx: PlayerSortCtx,
): number | string {
  switch (key) {
    case "nation":
      return row.nation ?? "";
    case "type":
      return TYPE_ABBR[row.type ?? ""] ?? row.type ?? "";
    case "tier":
      return row.tier ?? 0;
    case "name":
      return row.name.toLowerCase();
    default:
      return PLAYER_COLUMN_BY_KEY[key]?.sortValue(row, ctx) ?? -1;
  }
}

/** The garage table's order: the four identity columns by their own values,
 * every other column by what its definition says it sorts on. */
export function compareRows(
  a: PlayerTankRow,
  b: PlayerTankRow,
  state: SortState,
  ctx: PlayerSortCtx,
): number {
  // Default: most battles first.
  if (!state) return b.battles - a.battles;
  const mul = state.direction === SortDirection.Asc ? 1 : -1;
  const av = sortValue(a, state.key, ctx);
  const bv = sortValue(b, state.key, ctx);
  if (typeof av === "string" && typeof bv === "string") {
    return mul * av.localeCompare(bv);
  }
  return mul * ((av as number) - (bv as number));
}
