// Imported from deep, env-free module paths rather than the package barrels on
// purpose: `scripts/inject-openapi-enums.ts` loads this module during the build
// chain (incl. `postinstall`, which may run with no env), and the barrels
// re-export `env.ts` whose t3-env validation would throw when the WG app ids are
// absent. Each enum file below imports nothing that reaches env, so this stays a
// pure, env-free value source. (The app-side `schemas.ts` still imports these
// enums from the barrels, the usual convention, only this build-tooling module
// takes the deep-path exception.)
import { RatingMetric } from "@unicum.gg/shared/constants/rating";
import { RatingColor } from "@unicum.gg/shared/wot/ratings";
import { GlossaryCategory } from "@unicum.gg/shared/glossary/category";
import { GlossaryLinkTarget } from "@unicum.gg/shared/glossary/links";
import { MapGameMode } from "@unicum.gg/shared/wot/maps/game-modes";
import { MapCamouflage } from "@unicum.gg/shared/wot/maps/camouflage";
import { BattleType } from "@unicum.gg/shared/wot/maps/battle-types";
import { ClanBoard } from "@unicum.gg/shared/clans/badges";
import {
  StrongholdPeriod,
  StrongholdSort,
  StrongholdTier,
} from "@unicum.gg/shared/constants/stronghold";
import { MarkWindow } from "@unicum.gg/shared/players/mark-progress";
import { SessionGranularity } from "@unicum.gg/shared/players/sessions";
import { ServerStatsRange } from "@unicum.gg/shared/wot/server-stats";
import { SpawnDirection } from "@unicum.gg/shared/wot/tanks/videos";
import { TankClient } from "@unicum.gg/shared/wot/tanks/common-test";
import { TankAxis } from "@unicum.gg/shared/wot/tank-spec-fields";
import {
  BattleFormat,
  BattleResult,
} from "@unicum.gg/shared/db/schema/tank-videos";
import {
  ReviewOutcome,
  TankRatingAxis,
  TankReviewStatus,
  VoterBracket,
} from "@unicum.gg/shared/db/schema/tank-ratings";
import {
  RatingBlock,
  RatingConsensus,
} from "@unicum.gg/shared/wot/tank-ratings";
import {
  FeedbackSentiment,
  FeedbackTopic,
} from "@unicum.gg/shared/feedback/index";
import { VehicleType } from "@unicum.gg/wargaming/api/wot/encyclopedia";
import { Region } from "@unicum.gg/wargaming/region";
import {
  BracketType,
  TournamentGameMode,
  TournamentStatus,
} from "@unicum.gg/wargaming/tournaments/wot/catalog";
import { TournamentTeamStatus } from "@unicum.gg/wargaming/tournaments/wot/teams";
import { TopPlayersPeriod } from "@unicum.gg/core/wargaming/wot/players/top/period";
import { TopClansPeriod } from "@unicum.gg/core/wargaming/wot/clans/top/period";

/**
 * The single source for every enum param/field in the public API doc.
 *
 * next-openapi-gen's static AST reader can only pull an enum's values from an
 * inline literal or a same-file const (never an imported array or a native
 * enum), so `z.enum(SomeEnum)` in `schemas.ts` produces a param with no `enum`
 * in the generated spec. Rather than re-typing every value as a guarded literal,
 * each such schema carries an `x-enum-source` marker naming a key here, and
 * `scripts/inject-openapi-enums.ts` fills the values from these domain enums
 * after generation. So the domain enum is the one source: add a value there and
 * it flows to Zod validation (via `z.enum`) and to the doc/SDK (via injection),
 * with no literal to keep in sync.
 */
export const OPENAPI_ENUM_SOURCES = {
  REGION: Object.values(Region),
  METRIC: Object.values(RatingMetric),
  RATING_COLOR: Object.values(RatingColor),
  PLAYER_PERIOD: Object.values(TopPlayersPeriod),
  CLAN_PERIOD: Object.values(TopClansPeriod),
  MAP_MODE: Object.values(MapGameMode),
  MAP_CAMOUFLAGE: Object.values(MapCamouflage),
  MAP_BATTLE_TYPE: Object.values(BattleType),
  CLAN_BOARD: Object.values(ClanBoard),
  STRONGHOLD_PERIOD: Object.values(StrongholdPeriod),
  STRONGHOLD_TIER: Object.values(StrongholdTier),
  STRONGHOLD_SORT: Object.values(StrongholdSort),
  BATTLE_RESULT: Object.values(BattleResult),
  BATTLE_FORMAT: Object.values(BattleFormat),
  SPAWN_DIRECTION: Object.values(SpawnDirection),
  TANK_CLIENT: Object.values(TankClient),
  TANK_AXIS: Object.values(TankAxis),
  VOTER_BRACKET: Object.values(VoterBracket),
  TANK_RATING_AXIS: Object.values(TankRatingAxis),
  TANK_REVIEW_STATUS: Object.values(TankReviewStatus),
  RATING_CONSENSUS: Object.values(RatingConsensus),
  RATING_BLOCK: Object.values(RatingBlock),
  REVIEW_OUTCOME: Object.values(ReviewOutcome),
  SESSION_GRANULARITY: Object.values(SessionGranularity),
  MARK_WINDOW: Object.values(MarkWindow),
  SERVER_STATS_RANGE: Object.values(ServerStatsRange),
  VEHICLE_TYPE: Object.values(VehicleType),
  FEEDBACK_TOPIC: Object.values(FeedbackTopic),
  FEEDBACK_SENTIMENT: Object.values(FeedbackSentiment),
  GLOSSARY_CATEGORY: Object.values(GlossaryCategory),
  GLOSSARY_LINK_TARGET: Object.values(GlossaryLinkTarget),
  TOURNAMENT_STATUS: Object.values(TournamentStatus),
  TOURNAMENT_GAME_MODE: Object.values(TournamentGameMode),
  TOURNAMENT_BRACKET_TYPE: Object.values(BracketType),
  TOURNAMENT_TEAM_STATUS: Object.values(TournamentTeamStatus),
} satisfies Record<string, readonly string[]>;

/** Marker value a schema's `x-enum-source` may name. A typo is a compile error
 * where the marker is written, and the injection script throws on an unknown
 * one, so a source can never silently go unfilled. */
export type EnumSourceKey = keyof typeof OPENAPI_ENUM_SOURCES;
