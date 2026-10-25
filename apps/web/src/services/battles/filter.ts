import type { PlayerBattleFilter } from "@unicum.gg/core/battles/filters";
import { BattleResultFilter } from "@unicum.gg/shared";

/**
 * The filters a request names, each dropped rather than rejected when it does
 * not parse: a filter that reads as nothing gives the whole list, which is
 * what a hand-edited URL with a typo in it should get.
 */
export function battleFilterFrom(query: URLSearchParams): PlayerBattleFilter {
  const filter: PlayerBattleFilter = {};
  const mode = Number(query.get("mode"));
  if (query.get("mode") && Number.isInteger(mode)) filter.battleType = mode;
  const tank = Number(query.get("tank"));
  if (query.get("tank") && Number.isInteger(tank)) filter.tank = tank;
  const map = query.get("map");
  if (map) filter.map = map;
  const result = query.get("result");
  if (Object.values(BattleResultFilter).includes(result as BattleResultFilter)) {
    filter.result = result as BattleResultFilter;
  }
  return filter;
}
