import Image from "next/image";
import { markerUrl, type MapMarker, type MapPoi } from "@unicum.gg/shared";

// The game's own minimap entry markers, extracted from the client battle atlas
// into the wot.maps mirror. Ally reads green, enemy red, exactly as in-game.
export const BASE = {
  team1: markerUrl("base_ally"),
  team2: markerUrl("base_enemy"),
};
export const CONTROL_POINT = markerUrl("control_point");

// Capture-zone ring colours, matched to the flag discs (green ally, red enemy,
// white neutral control point): [border, translucent fill].
const RING = {
  team1: ["rgba(74,222,128,0.85)", "rgba(74,222,128,0.12)"],
  team2: ["rgba(248,113,113,0.85)", "rgba(248,113,113,0.12)"],
  neutral: ["rgba(255,255,255,0.8)", "rgba(255,255,255,0.10)"],
} as const;

// Spawn points are numbered 1..4 in game; clamp anything beyond onto the last.
export function spawnUrl(team: "team1" | "team2", i: number): string {
  const side = team === "team1" ? "ally" : "enemy";
  return markerUrl(`spawn_${side}_${Math.min(i + 1, 4)}`);
}

// Onslaught points of interest: type 1 = strike, 2 = recon. Their capture zones
// differ (strike 40 m, recon 20 m radius), so each is drawn to its own scale.
export const POI_STRIKE = markerUrl("poi_strike");
export const POI_RECON = markerUrl("poi_recon");
function poiUrl(type: number): string {
  return type === 2 ? POI_RECON : POI_STRIKE;
}
function poiRadiusM(type: number): number {
  return type === 2 ? 20 : 40;
}

function at(marker: MapMarker): React.CSSProperties {
  return { left: `${marker.left}%`, top: `${marker.top}%` };
}

export function Marker({
  src,
  size,
  marker,
}: {
  src: string;
  size: number;
  marker: MapMarker;
}) {
  return (
    // `width: max-content` so the shrink-to-fit box isn't squeezed by the space
    // left to the container edge: a marker near the right/left border would
    // otherwise render tiny (the image's `max-width: 100%` shrinks with it).
    <span
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ ...at(marker), width: "max-content" }}
    >
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
      />
    </span>
  );
}

// A base / control point drawn to scale: the real 100 m capture circle (sized as
// a percentage of the map's own metres, so it registers 1:1 with the minimap),
// with the game's flag disc centred inside it, exactly as it reads in battle.
function CaptureZone({
  icon,
  ring,
  marker,
  sizeX,
  sizeY,
  iconSize = 60,
}: {
  icon: string;
  ring: readonly [string, string];
  marker: MapMarker;
  sizeX: number;
  sizeY: number;
  iconSize?: number;
}) {
  return (
    <>
      <span
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          ...at(marker),
          width: `${sizeX}%`,
          height: `${sizeY}%`,
          border: `1.5px solid ${ring[0]}`,
          background: ring[1],
        }}
      />
      <Marker src={icon} size={iconSize} marker={marker} />
    </>
  );
}

// A minimap "view": one battle-context (a random mode, or Onslaught) with its
// own overlay geometry. Onslaught ships reduced bounds + capturable points of
// interest, so each view carries its own geometry instead of sharing the map's.
export type ViewGeometry = {
  bases: { team1: MapMarker[]; team2: MapMarker[] };
  spawns: { team1: MapMarker[]; team2: MapMarker[] };
  controlPoint: MapMarker | null;
  pois: MapPoi[];
};

/** The base flags, spawns, control point and Onslaught POIs of one view, drawn
 * over the minimap. `capX`/`capY` are the 100 m capture circle as a percent of
 * the play area; POIs size to their own metric radius against `mapWidth/Height`. */
export function Overlay({
  geometry,
  capX,
  capY,
  mapWidth,
  mapHeight,
}: {
  geometry: ViewGeometry;
  capX: number;
  capY: number;
  mapWidth: number;
  mapHeight: number;
}) {
  return (
    <>
      {geometry.bases.team1.map((p, i) => (
        <CaptureZone
          key={`b1-${i}`}
          icon={BASE.team1}
          ring={RING.team1}
          marker={p}
          sizeX={capX}
          sizeY={capY}
        />
      ))}
      {geometry.bases.team2.map((p, i) => (
        <CaptureZone
          key={`b2-${i}`}
          icon={BASE.team2}
          ring={RING.team2}
          marker={p}
          sizeX={capX}
          sizeY={capY}
        />
      ))}
      {geometry.spawns.team1.map((p, i) => (
        <Marker key={`s1-${i}`} src={spawnUrl("team1", i)} size={58} marker={p} />
      ))}
      {geometry.spawns.team2.map((p, i) => (
        <Marker key={`s2-${i}`} src={spawnUrl("team2", i)} size={58} marker={p} />
      ))}
      {geometry.pois.map((poi, i) => {
        const d = 2 * poiRadiusM(poi.type);
        return (
          <CaptureZone
            key={`poi-${i}`}
            icon={poiUrl(poi.type)}
            ring={RING.neutral}
            marker={poi.marker}
            sizeX={(d / mapWidth) * 100}
            sizeY={(d / mapHeight) * 100}
            iconSize={30}
          />
        );
      })}
      {geometry.controlPoint && (
        <CaptureZone
          icon={CONTROL_POINT}
          ring={RING.neutral}
          marker={geometry.controlPoint}
          sizeX={capX}
          sizeY={capY}
        />
      )}
    </>
  );
}
