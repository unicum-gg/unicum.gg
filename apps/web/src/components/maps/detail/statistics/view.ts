import type { LoadoutMode, MapStatistics } from "@unicum.gg/shared";
import type { TopBattlePayload } from "@/components/tanks/detail/loadouts/view";

/** What the endpoint answers for one mode: the figures, with the best battles
 * already drawn as battle rows. */
export type MapStatisticsPayload = MapStatistics & {
  topBattles: TopBattlePayload[];
};

/** One battle mode's figures. What the page loads and the tab draws. */
export interface MapStatisticsModeView {
  mode: LoadoutMode;
  stats: MapStatisticsPayload;
}
