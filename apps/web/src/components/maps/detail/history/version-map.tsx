"use client";

import { useId } from "react";
import {
  MAP_AREA_MAP,
  MAP_AREA_ONSLAUGHT,
  MAP_VARIANT_PREFIX,
  mapChangeArea,
  splitVariantField,
  type MapChangeArea,
  type MapVariantLayout,
  MapPoiType,
  MARKER_MOVE_THRESHOLD_M,
  matchMarkers,
  type MapDetail,
  type MapHistoryPoint,
} from "@unicum.gg/shared";
import Image from "next/image";
import { MinimapImage } from "@/components/maps/minimap-image";
import { buildArrows } from "@/components/maps/detail/history/arrows";
import {
  BASE,
  CONTROL_POINT,
  poiUrl,
  spawnUrl,
} from "@/components/maps/detail/minimap-overlay";
import type { FormattedMapChange } from "@/components/maps/change-format";

/** The gameplay token a geometry field belongs to (`geometry:comp7:spawns:team1`). */
// A change recorded on a variant arena carries a `variant:<battleType>:` prefix,
// which sits in front of the key these read, so it comes off first.
const stripVariant = (field: string) =>
  splitVariantField(field)?.field ?? field;

/** The marker family a geometry field describes (`bases:team1`, `controlPoint`,
 * `pointsOfInterest:recon`, ...). */
const familyOf = (field: string) =>
  stripVariant(field).split(":").slice(2).join(":");

/**
 * The game's own minimap icon for a marker family.
 *
 * The same ones the map's viewer draws, so a base reads as a base and a spawn as
 * a spawn here too: a row of identical dots says something moved without ever
 * saying what. Spawns are numbered 1..4 in game, so each takes its own numeral.
 */
function iconFor(field: string, index: number): string {
  const family = familyOf(field);
  if (family === "bases:team1") return BASE.team1;
  if (family === "bases:team2") return BASE.team2;
  if (family === "spawns:team1") return spawnUrl("team1", index);
  if (family === "spawns:team2") return spawnUrl("team2", index);
  if (family === "pointsOfInterest:recon") return poiUrl(MapPoiType.CommsCenter);
  if (family === "pointsOfInterest:flare") {
    return poiUrl(MapPoiType.ObservationPost);
  }
  if (family.startsWith("pointsOfInterest")) {
    return poiUrl(MapPoiType.ArtilleryHeadquarters);
  }
  return CONTROL_POINT;
}

/** Marker size on this small map, in pixels: the viewer's own markers are sized
 * for a full-width minimap and would swamp a 16rem one. */
const ICON = 22;

/** One marker of a version's before/after overlay, drawn with the game's icon.
 * The old position is ghosted and the new one solid, which is the whole reading
 * of the pair. */
function HistoryMarker({
  src,
  at,
  ghost,
}: {
  src: string;
  at: { left: string; top: string };
  ghost?: boolean;
}) {
  return (
    <span
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ ...at, width: "max-content" }}
    >
      <Image
        src={src}
        alt=""
        width={ICON}
        height={ICON}
        className={
          ghost
            ? "opacity-45 grayscale drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
            : "drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
        }
      />
    </span>
  );
}

/**
 * What this area's minimap would draw, or null when there is nothing to draw.
 *
 * Nothing to draw means: no marker moved, the map has no play area to project
 * onto, or the area asked for is Onslaught on a map that no longer has one. That
 * last case is why the area is passed in rather than guessed from the markers:
 * an Onslaught spawn drawn over the full map would be pointing at a place on a
 * different image, at a different scale.
 */
/** The space an area is drawn on: the map's own Onslaught layout, a variant's
 * (its Onslaught one when it has one, else the variant arena itself), or null
 * for the map, which draws on its own minimap. */
function spaceFor(
  detail: MapDetail,
  area: MapChangeArea,
): { arenaId: string; minimapUrl: string; widthMeters: number; heightMeters: number } | null {
  if (area === MAP_AREA_ONSLAUGHT) return detail.onslaught;
  if (!area.startsWith(MAP_VARIANT_PREFIX)) return null;
  const battleType = area.slice(MAP_VARIANT_PREFIX.length);
  const variant = detail.variants.find(
    (v: MapVariantLayout) => v.battleType === battleType,
  );
  if (!variant) return null;
  return variant.onslaught ?? variant;
}

function plan(
  detail: MapDetail,
  changes: FormattedMapChange[],
  area: MapChangeArea,
) {
  // The area a change belongs to is what the shared vocabulary says, so the
  // three of them (the map, Onslaught, and the night arena) are told apart the
  // same way here as in the rows beside this minimap.
  const geometry = changes.filter(
    (c) => c.markers && mapChangeArea(c.field) === area,
  );
  if (geometry.length === 0) return null;
  // Each area draws on its own space: the map's, its Onslaught layout's, or a
  // variant's, which is a different arena again.
  const space = spaceFor(detail, area);
  if (area !== MAP_AREA_MAP && !space) return null;
  const width = space?.widthMeters ?? detail.widthMeters;
  const height = space?.heightMeters ?? detail.heightMeters;
  if (width <= 0 || height <= 0) return null;
  return { geometry, onslaught: space, width, height };
}

/** Whether this area has a minimap to draw for these changes. */
export function hasVersionMinimap(
  detail: MapDetail,
  changes: FormattedMapChange[],
  area: MapChangeArea,
): boolean {
  return plan(detail, changes, area) !== null;
}

/**
 * Where a version's markers were and where they went, drawn over the map.
 *
 * The one thing a list of coordinates cannot say: a spawn moving 200 m across
 * Prokhorovka means nothing as a number and everything as a position. The old
 * places are hollow, the new ones solid, so the move reads at a glance.
 *
 * Positions are stored in metres from the play area's bottom-left corner, and
 * projected here against the map's *current* area. A map whose area was re-cut
 * since therefore shows its old markers slightly off; that is the same
 * compromise as drawing them on today's minimap at all, which is the only one
 * we have.
 */
export function VersionMinimap({
  detail,
  changes,
  area,
}: {
  detail: MapDetail;
  changes: FormattedMapChange[];
  /** Which of the map's two play areas to draw. */
  area: MapChangeArea;
}) {
  const arrowId = useId();
  const drawn = plan(detail, changes, area);
  if (!drawn) return null;
  const { geometry, onslaught, width, height } = drawn;

  // Percent of the image, clamped: a marker whose play area was re-cut since can
  // project outside it, and half a marker on the edge reads better than one that
  // is not there.
  const px = (p: MapHistoryPoint) => Math.max(0, Math.min(100, (p.x / width) * 100));
  const py = (p: MapHistoryPoint) =>
    Math.max(0, Math.min(100, 100 - (p.z / height) * 100));
  const project = (p: MapHistoryPoint) => ({
    left: `${px(p)}%`,
    top: `${py(p)}%`,
  });

  const before = geometry.flatMap((c) => c.markers?.before ?? []);
  const after = geometry.flatMap((c) => c.markers?.after ?? []);
  // Every marker drawn is something an arrow has to stay clear of, its own two
  // ends excepted: a line grazing a third marker reads as if it came from there.
  const obstacles = [...before, ...after].map((p) => ({ x: px(p), y: py(p) }));

  // Markers are paired within their own group, never across: an arrow must join
  // a spawn to that same spawn's new place, not to the nearest base. A marker
  // that only appeared or disappeared has no arrow, and neither has one that
  // barely shifted (the same threshold the diff calls "moved").
  const arrows = buildArrows(
    geometry
      .flatMap((c) =>
        c.markers ? matchMarkers(c.markers.before, c.markers.after) : [],
      )
      .filter((m) => m.distance > MARKER_MOVE_THRESHOLD_M)
      .map((m) => ({
        from: { x: px(m.from), y: py(m.from) },
        to: { x: px(m.to), y: py(m.to) },
      })),
    obstacles,
  );

  return (
    <div className="relative aspect-square w-full overflow-hidden">
      <MinimapImage
        src={onslaught?.minimapUrl ?? detail.minimapUrl}
        arenaId={onslaught?.arenaId ?? detail.arenaId}
        alt={`${detail.name} minimap`}
        sizes="(max-width: 1024px) 100vw, 20rem"
        className="opacity-70"
      />
      {arrows.length > 0 ? (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden
        >
          <defs>
            <marker
              id={arrowId}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(251 191 36)" />
            </marker>
          </defs>
          {arrows.map((arrow, i) => (
            <path
              key={`m-${i}`}
              d={arrow.path}
              fill="none"
              stroke="rgb(251 191 36)"
              strokeWidth="0.7"
              strokeOpacity="0.9"
              markerEnd={`url(#${arrowId})`}
              style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.8))" }}
            />
          ))}
        </svg>
      ) : null}
      {geometry.map((change) =>
        (change.markers?.before ?? []).map((p, i) => (
          <HistoryMarker
            key={`b-${change.field}-${i}`}
            src={iconFor(change.field, i)}
            at={project(p)}
            ghost
          />
        )),
      )}
      {geometry.map((change) => {
        const before = change.markers?.before ?? [];
        const after = change.markers?.after ?? [];
        // A spawn's numeral comes from its rank in the stored list, and the two
        // lists are not in the same order between versions. Numbering each side
        // independently would send an arrow from ghost spawn 1 to solid spawn 3,
        // which reads as a spawn that changed identity. So a paired marker keeps
        // the numeral of the marker it came from — the same pairing the arrow
        // itself was drawn from.
        const pairs = matchMarkers(before, after);
        return after.map((p, i) => {
          const from = pairs.find((m) => m.to === p)?.from;
          const rank = from ? before.indexOf(from) : i;
          return (
            <HistoryMarker
              key={`a-${change.field}-${i}`}
              src={iconFor(change.field, rank)}
              at={project(p)}
            />
          );
        });
      })}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 bg-black/55 py-1 text-[11px] text-white">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-white/45" />
          Before
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-white" />
          After
        </span>
      </div>
    </div>
  );
}
