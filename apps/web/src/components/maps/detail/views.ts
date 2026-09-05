// The minimap viewer's model: what a map can be looked at as.
//
// Apart from the component that draws it because the rest of the section reads
// it too: a gallery card links straight to a map's Onslaught view and the page
// asks which view is an Onslaught one, so both ends of those contracts have to
// name a view the same way, and neither has any business pulling the whole
// viewer in to do it.

import {
  BATTLE_TYPE_LABEL,
  BattleType,
  SPAWN_DIRECTION_LABEL,
  spawnDirection,
  type MapDetail,
  type MapVariantLayout,
} from "@unicum.gg/shared";
import type { ViewGeometry } from "@/components/maps/detail/minimap-overlay";

/** The side a team starts from on this view, e.g. "South". Null when the mode
 * declares neither spawns nor bases, where the legend just names the team. */
export function teamSide(view: ViewGeometry, team: 1 | 2): string | null {
  const direction = spawnDirection(view, team);
  return direction ? SPAWN_DIRECTION_LABEL[direction] : null;
}

/** View key of the Onslaught play area, the one view that is not a random
 * battle. Exported because the gallery links straight to it (`?view=`), so both
 * ends of that contract read the same constant. */
export const ONSLAUGHT_VIEW = "onslaught";

/** The view key of one variant, which is its battle type: `?view=waffentrager`
 * and the gallery tab `/maps/all/waffentrager` name the same thing, and the URL
 * stays readable and stable rather than carrying an internal arena id. */
export const variantViewKey = (battleType: BattleType): string => battleType;

/** The variant a view key selects, or null when the key names one of the map's
 * own views. */
export function variantForKey(
  detail: MapDetail,
  key: string,
): MapVariantLayout | null {
  return (
    detail.variants.find(
      (v: MapVariantLayout) => variantViewKey(v.battleType) === key,
    ) ?? null
  );
}

/** Whether a view key is one of the map's Onslaught areas, its own or a
 * variant's: those are played on a reduced space and always 7v7, which the
 * page's stats follow. */
export function isOnslaughtView(detail: MapDetail, key: string): boolean {
  if (key === ONSLAUGHT_VIEW) return detail.onslaught !== null;
  const variant = variantForKey(detail, key);
  return variant?.onslaught != null;
}

// A selectable minimap view: one battle-context (a random mode, or Onslaught)
// with its own minimap image + play-area bounds on top of the shared geometry.
export type MapView = ViewGeometry & {
  key: string;
  label: string;
  /** Whether the view is an Onslaught layout. Not derivable from the key any
   * more: a night layout is keyed by its own arena, so a `=== ONSLAUGHT_VIEW`
   * test would read it as a random-battle view. */
  onslaught: boolean;
  /** Whether the view's own space is only on the test client, which decides
   * which branch of the mirror its image comes from. */
  commonTest: boolean;
  /** Whether the view is one of the map's variants. The pill wears the crest
   * only there: on a map that is wholly test-only the title already says it, and
   * repeating it on every pill would be noise. */
  variant: boolean;
  /** The arena the view's minimap belongs to, which is the map itself except on
   * a dedicated Onslaught arena's view: it is a different space, so its image
   * must not fall back to the map's own. */
  arenaId: string;
  minimapUrl: string;
  widthMeters: number;
  heightMeters: number;
};

export function buildViews(detail: MapDetail): MapView[] {
  const views: MapView[] = detail.geometry.map((g) => ({
    key: g.mode,
    label: g.label,
    onslaught: false,
    commonTest: detail.commonTest,
    variant: false,
    arenaId: detail.arenaId,
    minimapUrl: detail.minimapUrl,
    widthMeters: detail.widthMeters,
    heightMeters: detail.heightMeters,
    bases: g.bases,
    spawns: g.spawns,
    controlPoint: g.controlPoint,
    pois: [],
  }));
  if (detail.onslaught) {
    views.push({
      key: ONSLAUGHT_VIEW,
      label: BATTLE_TYPE_LABEL[BattleType.Onslaught],
      onslaught: true,
      commonTest: detail.commonTest,
      variant: false,
      arenaId: detail.arenaId,
      minimapUrl: detail.onslaught.minimapUrl,
      widthMeters: detail.onslaught.widthMeters,
      heightMeters: detail.onslaught.heightMeters,
      bases: { team1: [], team2: [] },
      spawns: detail.onslaught.spawns,
      controlPoint: detail.onslaught.controlPoint,
      pois: detail.onslaught.pointsOfInterest,
    });
  }
  // Each variant is a whole arena of its own, so it gets one view: its Onslaught
  // layout when that is what it is played on (the night versions), else the
  // first of its own modes. A map is not played twice on the same space.
  for (const variant of detail.variants) {
    const geo = variant.onslaught ? null : (variant.geometry[0] ?? null);
    views.push({
      key: variantViewKey(variant.battleType),
      label: BATTLE_TYPE_LABEL[variant.battleType],
      onslaught: variant.onslaught !== null,
      commonTest: variant.commonTest,
      variant: true,
      arenaId: variant.arenaId,
      minimapUrl: variant.minimapUrl,
      widthMeters: variant.onslaught?.widthMeters ?? variant.widthMeters,
      heightMeters: variant.onslaught?.heightMeters ?? variant.heightMeters,
      bases: geo?.bases ?? { team1: [], team2: [] },
      spawns: variant.onslaught?.spawns ?? geo?.spawns ?? { team1: [], team2: [] },
      controlPoint: variant.onslaught?.controlPoint ?? geo?.controlPoint ?? null,
      pois: variant.onslaught?.pointsOfInterest ?? [],
    });
  }
  return views;
}
