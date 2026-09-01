import type { PlayerClanHistoryFull } from "../clans/player-history";
import type {
  PeriodStats,
  PlayerDerivedStats,
} from "./derived-stats";
import type { LiftDragByMetric } from "./lift-drag";
import type { PlayerMarkProgress } from "./mark-progress";
import type { RatingHistoryPoint } from "./rating-history";
import type { Stats } from "./stats";
import type { StrongholdStats } from "./stronghold-stats";
import type { PlayerValuation } from "./valuation";

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
// encyclopedia or expected-value tables. `liftDrag` and `ratingHistory` carry
// all three metrics, so the payload is metric-agnostic (and the page cacheable);
// the client selects the active metric from its rating-metric cookie.
/** A name a player (or clan) used before its current one, with when we observed
 * it stop being current. Newest first. */
export type NameHistoryEntry = { nickname: string; recordedAt: Date };

export type PlayerDetailData = {
  player: {
    accountId: number;
    nickname: string;
    createdAt: Date;
    /** Null when the account has no battle to date: never played, or never
     * fetched (see `lastBattleOrNull`, which is what maps both to null). */
    lastBattleAt: Date | null;
    updatedAt: Date;
  };
  /** Previous nicknames of this account, newest first (empty until a rename is
   * observed; WG exposes no historical names). */
  nameHistory: NameHistoryEntry[];
  // This account belongs to an active (and non-anonymous) unicum.gg supporter,
  // for the supporter badge on the player header.
  isSupporter: boolean;
  // The owner has connected this account on the site (Wargaming.net ID sign-in),
  // for the verified badge.
  isVerified: boolean;
  // The Twitch login of this account's linked channel (for the streamer badge's
  // link), or null when the account is not a streamer.
  twitchLogin: string | null;
  current: Stats;
  periods: PeriodStats;
  derived: PlayerDerivedStats;
  // Count of tanks the player has battles in — a single number so the "Tanks"
  // tab can show "Tanks (N)" without shipping the (heavy) per-tank list, which
  // lives on its own `/tanks` endpoint and loads on demand.
  tankCount: number;
  /** Distinct medals earned, for the "Achievements (N)" tab label. */
  achievementCount: number;
  // Estimated account worth (market resale + store rebuild cost), computed from
  // the garage. See `./valuation`.
  valuation: PlayerValuation;
  liftDrag: LiftDragByMetric;
  // Marks of Excellence and Marks of Mastery across the garage, plus the
  // vehicles the player's current form puts within reach of their next mark.
  // Optional so a payload cached under the previous shape (the detail cache is
  // a 60s TTL, so at most one minute of them) reads as absent rather than
  // crashing the panel.
  markProgress?: PlayerMarkProgress;
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
