import type { RatingMetric } from "../constants/rating";
import type { PlayerClanHistoryFull } from "../clans/player-history";
import type {
  PeriodStats,
  PlayerDerivedStats,
} from "./derived-stats";
import type { LiftDrag } from "./lift-drag";
import type { RatingHistoryPoint } from "./rating-history";
import type { Stats } from "./stats";
import type { StrongholdStats } from "./stronghold-stats";
import type { PlayerValuation } from "./valuation";
import type { PlayerVehicleRow } from "./vehicles";

export type StrongholdPeriodStats = {
  h24: StrongholdStats | null;
  d7: StrongholdStats | null;
  d30: StrongholdStats | null;
};

export type StrongholdModeData = {
  current: StrongholdStats | null;
  periods: StrongholdPeriodStats;
};

// One entry per non-random game mode shown on the player page, keyed by the
// domain mode name (the WG snapshot column prefixes), not by UI tab id.
export type PlayerStrongholdModes = {
  skirmish: StrongholdModeData;
  fortified: StrongholdModeData;
  epic: StrongholdModeData;
  ranked: StrongholdModeData;
  fallout: StrongholdModeData;
  cwAbsolute: StrongholdModeData;
  cwChampion: StrongholdModeData;
  cwMiddle: StrongholdModeData;
};

// The player detail resource: everything the player page tabs render and the
// `GET /api/[region]/players/[nickname]` endpoint exposes. All tank-breakdown
// derivations (stats grid, lift/drag, vehicle rows) are computed server-side
// (core `players/detail`) so the payload carries values, never the
// encyclopedia or expected-value tables. `liftDrag` and `ratingHistory` depend
// on the requested metric.
export type PlayerDetailData = {
  player: {
    accountId: number;
    nickname: string;
    createdAt: Date;
    lastBattleAt: Date;
    updatedAt: Date;
  };
  metric: RatingMetric;
  current: Stats;
  periods: PeriodStats;
  derived: PlayerDerivedStats;
  vehicles: PlayerVehicleRow[];
  // Estimated account worth (market resale + store rebuild cost), computed from
  // the garage. See `./valuation`.
  valuation: PlayerValuation;
  liftDrag: LiftDrag | null;
  ratingHistory: RatingHistoryPoint[];
  clanHistory: PlayerClanHistoryFull;
  strongholds: PlayerStrongholdModes;
};

export const EMPTY_CLAN_HISTORY: PlayerClanHistoryFull = {
  currentStint: null,
  pastStints: [],
  totalClans: 0,
  timeInClansSeconds: 0,
};
