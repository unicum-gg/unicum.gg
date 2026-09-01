"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BASE,
  CONTROL_POINT,
  Marker,
  poiUrl,
  spawnUrl,
} from "@/components/maps/detail/minimap-overlay";
import { cn } from "@/lib/utils";
import type { MapMarker } from "@unicum.gg/shared";
import type { TournamentRecord } from "./record";
import { TeamSlot } from "./team-run";

/** The two sides of an arena, as a tournament assigns them. */
type Sides = { team1: MapMarker[]; team2: MapMarker[] };

/** Marker size on a thumbnail this small. The full map page draws larger ones,
 * but here the minimap is 220px and a game-sized icon would cover the corner it
 * is pointing at. */
const MARKER_SIZE = 18;

/** Where a side's name sits: the middle of its own markers, so the label lands
 * on the corner that side actually starts in. */
function anchorOf(markers: MapMarker[]): MapMarker | null {
  if (markers.length === 0) return null;
  const left = markers.reduce((sum, m) => sum + m.left, 0) / markers.length;
  const top = markers.reduce((sum, m) => sum + m.top, 0) / markers.length;
  return { left, top };
}

/**
 * A side's name, written ON the minimap at its own spawn.
 *
 * The whole point of the panel is "which corner am I in", and a legend under the
 * image makes the reader carry a colour from the caption back up to a marker.
 * Putting the name where the team starts answers it in one look.
 *
 * The anchor flips against the nearest edge so a label never runs out of the
 * frame: a spawn in the right half hangs its name leftwards, one near the bottom
 * hangs it upwards.
 */
function TeamOnMap({
  at,
  slot,
  name,
  isViewing,
}: {
  at: MapMarker;
  slot: TeamSlot;
  name: string | null;
  isViewing: boolean;
}) {
  const one = slot === TeamSlot.One;
  const fromRight = at.left > 55;
  const nearBottom = at.top > 70;
  return (
    <span
      className={cn(
        // The game's own colours: team 1 green, team 2 red, matching the markers
        // underneath. Inert, so it never intercepts a click on the map.
        "pointer-events-none absolute z-10 max-w-[88%] truncate rounded-xs px-1 py-0.5 text-[10px] leading-tight font-semibold whitespace-nowrap text-white",
        one ? "bg-emerald-600/90" : "bg-red-600/90",
        isViewing && "ring-1 ring-white/70",
      )}
      style={{
        left: `${at.left}%`,
        top: `${at.top}%`,
        transform: `translate(${fromRight ? "-100%" : "0%"}, ${
          nearBottom ? "-180%" : "60%"
        })`,
      }}
    >
      {name ?? (one ? "Team 1" : "Team 2")}
    </span>
  );
}

/**
 * One map of a tie, with each side drawn where it actually started.
 *
 * This is the question a competitor has before every match and the reason the
 * whole panel exists: not "which maps were played" but "which corner am I
 * spawning in". The arena has a team 1 side and a team 2 side, the tie assigns
 * each team to one of them, and both facts are published, so the two together
 * put a name on each spawn.
 *
 * The one thing NOT asserted here is attacker versus defender. That mapping is
 * per tournament and carries named map exceptions (one real ruleset reverses
 * Sand River, Redshire and Live Oaks), so it is left to the Rules panel that
 * states it rather than guessed at from the side.
 */
export function MatchMinimap({
  map,
  team1Name,
  team2Name,
  viewingSlot,
  battle,
  swapped,
  href,
}: {
  map: TournamentRecord["mapPool"][number];
  team1Name: string | null;
  team2Name: string | null;
  /** Which side the team whose run is open played, so its own spawn stands out. */
  viewingSlot: TeamSlot;
  /** Which battle of the series this is, counting from 1. */
  battle?: number;
  /** The map's own page, when the catalogue carries it. Opened on the
   * tournament's battle type, like the pool grid and the bracket. */
  href?: string;
  /** Whether the sides are the mirror of the match's assignment.
   *
   * A map is played TWICE, once from each side, so its second battle reverses
   * team 1 and team 2. The arena's own sides never move: what swaps is which
   * team stands on each of them. */
  swapped?: boolean;
}) {
  if (!map.minimapUrl) return null;
  const spawns: Sides = map.spawns;
  const bases: Sides = map.bases;
  const side1Name = swapped ? team2Name : team1Name;
  const side2Name = swapped ? team1Name : team2Name;
  const viewingSide = swapped
    ? viewingSlot === TeamSlot.One
      ? TeamSlot.Two
      : TeamSlot.One
    : viewingSlot;
  // Bases count, not just spawns: Standard battles publish a base per side and
  // no spawn points at all, so testing spawns alone would call every Standard
  // map "not published" while its two sides are sitting right there.
  const hasGeometry =
    spawns.team1.length > 0 ||
    spawns.team2.length > 0 ||
    bases.team1.length > 0 ||
    bases.team2.length > 0 ||
    map.controlPoint !== null ||
    map.pointsOfInterest.length > 0;
  const team1Anchor =
    anchorOf(spawns.team1) ?? anchorOf(bases.team1);
  const team2Anchor =
    anchorOf(spawns.team2) ?? anchorOf(bases.team2);

  const frame = (
    <div className="relative aspect-square w-56 overflow-hidden rounded-sm border border-fd-border">
        <Image
          src={map.minimapUrl}
          alt={`${map.name ?? map.arenaId} minimap`}
          fill
          sizes="224px"
          className="object-cover"
          unoptimized
        />
        {bases.team1.map((m, i) => (
          <Marker key={`b1-${i}`} src={BASE.team1} size={MARKER_SIZE} marker={m} />
        ))}
        {bases.team2.map((m, i) => (
          <Marker key={`b2-${i}`} src={BASE.team2} size={MARKER_SIZE} marker={m} />
        ))}
        {spawns.team1.map((m, i) => (
          <Marker
            key={`s1-${i}`}
            src={spawnUrl("team1", i)}
            size={MARKER_SIZE}
            marker={m}
          />
        ))}
        {spawns.team2.map((m, i) => (
          <Marker
            key={`s2-${i}`}
            src={spawnUrl("team2", i)}
            size={MARKER_SIZE}
            marker={m}
          />
        ))}
        {/* What the mode is actually fought over. Drawn as plain markers rather
            than the map page's capture circles: at 224px a metric radius is a
            wash over the whole thumbnail, and the point of these is to say
            WHERE, not how big. */}
        {map.controlPoint && (
          <Marker src={CONTROL_POINT} size={MARKER_SIZE} marker={map.controlPoint} />
        )}
        {map.pointsOfInterest.map((poi, i) => (
          <Marker
            key={`poi-${i}`}
            src={poiUrl(poi.type)}
            size={MARKER_SIZE}
            marker={poi.marker}
          />
        ))}
        {/* Anchored on the spawns when the mode has them, on the bases when it
            does not: a Standard battle publishes a base per side and no spawn
            points, and the base is where that side belongs on the map. */}
        {team1Anchor && (
          <TeamOnMap
            at={team1Anchor}
            slot={TeamSlot.One}
            name={side1Name}
            isViewing={viewingSide === TeamSlot.One}
          />
        )}
        {team2Anchor && (
          <TeamOnMap
            at={team2Anchor}
            slot={TeamSlot.Two}
            name={side2Name}
            isViewing={viewingSide === TeamSlot.Two}
          />
        )}
    </div>
  );

  return (
    <figure className="flex w-56 shrink-0 flex-col gap-1.5">
      {/* The whole thumbnail opens the map, the way the pool grid does. An arena
          the catalogue does not carry has no page, so it stays a plain frame
          rather than a link that goes nowhere. */}
      {href ? (
        <Link href={href} className="group">
          {frame}
        </Link>
      ) : (
        frame
      )}
      <figcaption className="flex flex-col gap-0.5">
        <span className="flex items-baseline gap-1.5 truncate text-xs font-medium">
          {battle !== undefined && (
            <span className="shrink-0 text-[10px] text-fd-muted-foreground">
              #{battle}
            </span>
          )}
          {href ? (
            <Link href={href} className="truncate hover:text-brand hover:underline">
              {map.name ?? map.arenaId}
            </Link>
          ) : (
            <span className="truncate">{map.name ?? map.arenaId}</span>
          )}
        </span>
        {hasGeometry ? null : (
          // The pool named a map whose arena declares nothing for this battle
          // type, so there are no sides to put names against. Another mode's
          // positions are deliberately NOT substituted: the two sides sit
          // somewhere different per mode, and a plausible wrong corner is worse
          // than an honest blank.
          <span className="text-xs text-fd-muted-foreground">
            No sides published for this battle type
          </span>
        )}
      </figcaption>
    </figure>
  );
}
