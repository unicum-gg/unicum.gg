"use client";

import { projectPoint } from "@unicum.gg/shared";
import { cn } from "@/lib/utils";
import type { Participant } from "./battle-types";
import type { Bounds, Motion, Track } from "./replay-types";
import { BINOCULARS_DELAY_S, pathOf, pointAt, stillFor, valueAt } from "./replay-math";

/**
 * Inside this, an enemy is spotted whatever stands between: the game's
 * `VISIBILITY.MIN_RADIUS`.
 */
export const PROXIMITY_SPOTTING_M = 50;

/**
 * The farthest any vehicle can spot another, whatever its view range: past it,
 * a target is only ever revealed by somebody closer. `VISIBILITY.MAX_RADIUS`.
 */
export const MAX_SPOTTING_M = 445;

/**
 * How far the client draws other vehicles at all. Beyond it a spotted tank is
 * only a marker on the minimap, never a model in the world.
 * `VEHICLE_CIRCULAR_AOI_RADIUS`.
 */
export const DRAW_DISTANCE_M = 565;

/**
 * The rings the game draws around the vehicle it is following, centred on it
 * and moving with it: its own view range, the spotting ceiling every vehicle
 * shares, the draw distance, and the proximity ring. Same colours as the
 * game's minimap, so a player reads them without a legend. The view range is
 * drawn as the game draws it, capped at the spotting ceiling: past 445 m the
 * extra metres only make a vehicle spot sooner, never farther.
 *
 * Positions and radii are in percent of the map, which is square, so one
 * figure serves both axes.
 */
export function FocusRings({
  left,
  top,
  metres,
  viewRange,
  estimated,
  dimmed,
}: {
  /** The vehicle's position, in percent of the map. */
  left: number;
  top: number;
  /** The map's width in metres, to turn a range into a share of it. */
  metres: number;
  /** Null when the catalogue has no figure: the fixed rings still mean something. */
  viewRange: number | null;
  /** The vehicle's base figure rather than its real one, drawn dashed so an
   * approximation never passes for the measurement. */
  estimated: boolean;
  /** Out of sight: drawn around where it was last seen, fainter. */
  dimmed: boolean;
}) {
  if (!metres) return null;
  const rings = [
    viewRange
      ? {
          range: Math.min(viewRange, MAX_SPOTTING_M),
          className: cn("border-emerald-400/80", estimated && "border-dashed"),
        }
      : null,
    { range: PROXIMITY_SPOTTING_M, className: "border-white/70" },
    { range: MAX_SPOTTING_M, className: "border-white/70" },
    { range: DRAW_DISTANCE_M, className: "border-amber-300/80" },
  ].filter((ring) => ring !== null);
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", dimmed && "opacity-40")}
    >
      {rings.map((ring) => {
        const size = (ring.range * 2 * 100) / metres;
        return (
          <span
            key={`${ring.className}-${ring.range}`}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size}%`,
              height: `${size}%`,
            }}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border drop-shadow-[0_0_1px_rgba(0,0,0,0.9)]",
              ring.className,
            )}
          />
        );
      })}
    </div>
  );
}

/**
 * The rings around whoever the replay is following, at the right radius for
 * them: the figure the server itself sent the recorder, then the one rebuilt
 * from their loadout, then the base one, drawn dashed.
 */
export function FocusLayer({
  participants,
  highlightAccount,
  tracksById,
  motion,
  at,
  ticks,
  bounds,
  recorderTeam,
}: {
  participants: Participant[];
  highlightAccount?: number;
  tracksById: Map<number, Track>;
  motion: Motion;
  at: number;
  ticks: number;
  bounds: Bounds;
  recorderTeam: number | null;
}) {
  const focused = participants.find(
    (p) => p.account !== undefined && p.account === highlightAccount,
  );
  const track = focused ? tracksById.get(focused.id) : undefined;
  if (!focused || !track) return null;
  if (track.diedAt !== null && at * ticks >= track.diedAt) return null;
  const point = pointAt(
    pathOf(track),
    at,
    ticks,
    motion.startsAt ?? 0,
    focused.team === recorderTeam,
  );
  if (!point) return null;
  const where = projectPoint({ x: point.x, z: point.z }, bounds);
  // Best first: the figure the server itself sent the recorder, then the
  // one rebuilt from their loadout (with the binoculars' share once the
  // vehicle has stood still long enough for them to work), then the base
  // one, drawn dashed.
  const exact =
    focused.id === motion.loadouts?.[0]?.vehicle && motion.vision?.length
      ? valueAt(motion.vision, at * ticks)
      : null;
  const vision = focused.vision;
  const range =
    exact ??
    (vision
      ? stillFor(track.points, at, ticks) >= BINOCULARS_DELAY_S
        ? vision.still
        : vision.moving
      : (focused.tank?.viewRange ?? null));
  const known = exact !== null || Boolean(vision);
  return (
    <FocusRings
      left={where.left}
      top={where.top}
      metres={bounds.upperRight.x - bounds.bottomLeft.x}
      viewRange={range}
      estimated={!known}
      dimmed={!point.spotted || Boolean(point.estimated)}
    />
  );
}
