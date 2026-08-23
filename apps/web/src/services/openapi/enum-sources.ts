// Imported from deep, env-free module paths rather than the package barrels on
// purpose: `scripts/inject-openapi-enums.ts` loads this module during the build
// chain (incl. `postinstall`, which may run with no env), and the barrels
// re-export `env.ts` whose t3-env validation would throw when the WG app ids are
// absent. Each enum file below imports nothing that reaches env, so this stays a
// pure, env-free value source. (The app-side `schemas.ts` still imports these
// enums from the barrels, the usual convention — only this build-tooling module
// takes the deep-path exception.)
import { RatingMetric } from "@unicum.gg/shared/constants/rating";
import { GlossaryCategory } from "@unicum.gg/shared/glossary/category";
import { GlossaryLinkTarget } from "@unicum.gg/shared/glossary/links";
import { MapGameMode } from "@unicum.gg/shared/wot/maps/game-modes";
import { MapCamouflage } from "@unicum.gg/shared/wot/maps/camouflage";
import { BattleType } from "@unicum.gg/shared/wot/maps/battle-types";
import { ClanBoard } from "@unicum.gg/shared/clans/badges";
import { SessionGranularity } from "@unicum.gg/shared/players/sessions";
import { SpawnDirection } from "@unicum.gg/shared/wot/tanks/videos";
import { TankClient } from "@unicum.gg/shared/wot/tanks/common-test";
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
import { Region } from "@unicum.gg/wargaming/region";
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
  PLAYER_PERIOD: Object.values(TopPlayersPeriod),
  CLAN_PERIOD: Object.values(TopClansPeriod),
  MAP_MODE: Object.values(MapGameMode),
  MAP_CAMOUFLAGE: Object.values(MapCamouflage),
  MAP_BATTLE_TYPE: Object.values(BattleType),
  CLAN_BOARD: Object.values(ClanBoard),
  BATTLE_RESULT: Object.values(BattleResult),
  BATTLE_FORMAT: Object.values(BattleFormat),
  SPAWN_DIRECTION: Object.values(SpawnDirection),
  TANK_CLIENT: Object.values(TankClient),
  VOTER_BRACKET: Object.values(VoterBracket),
  TANK_RATING_AXIS: Object.values(TankRatingAxis),
  TANK_REVIEW_STATUS: Object.values(TankReviewStatus),
  RATING_CONSENSUS: Object.values(RatingConsensus),
  RATING_BLOCK: Object.values(RatingBlock),
  REVIEW_OUTCOME: Object.values(ReviewOutcome),
  SESSION_GRANULARITY: Object.values(SessionGranularity),
  FEEDBACK_TOPIC: Object.values(FeedbackTopic),
  FEEDBACK_SENTIMENT: Object.values(FeedbackSentiment),
  GLOSSARY_CATEGORY: Object.values(GlossaryCategory),
  GLOSSARY_LINK_TARGET: Object.values(GlossaryLinkTarget),
} satisfies Record<string, readonly string[]>;

/** Marker value a schema's `x-enum-source` may name. A typo is a compile error
 * where the marker is written, and the injection script throws on an unknown
 * one, so a source can never silently go unfilled. */
export type EnumSourceKey = keyof typeof OPENAPI_ENUM_SOURCES;
