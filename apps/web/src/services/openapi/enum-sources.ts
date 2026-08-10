// Imported from deep, env-free module paths rather than the package barrels on
// purpose: `scripts/inject-openapi-enums.ts` loads this module during the build
// chain (incl. `postinstall`, which may run with no env), and the barrels
// re-export `env.ts` whose t3-env validation would throw when the WG app ids are
// absent. Each enum file below imports nothing that reaches env, so this stays a
// pure, env-free value source. (The app-side `schemas.ts` still imports these
// enums from the barrels, the usual convention — only this build-tooling module
// takes the deep-path exception.)
import { RatingMetric } from "@unicum.gg/shared/constants/rating";
import { MapGameMode } from "@unicum.gg/shared/wot/maps/game-modes";
import { MapCamouflage } from "@unicum.gg/shared/wot/maps/camouflage";
import { BattleType } from "@unicum.gg/shared/wot/maps/battle-types";
import { ClanBoard } from "@unicum.gg/shared/clans/badges";
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
} satisfies Record<string, readonly string[]>;

/** Marker value a schema's `x-enum-source` may name. A typo is a compile error
 * where the marker is written, and the injection script throws on an unknown
 * one, so a source can never silently go unfilled. */
export type EnumSourceKey = keyof typeof OPENAPI_ENUM_SOURCES;
