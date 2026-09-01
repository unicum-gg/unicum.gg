"use client";

import Image from "next/image";
import Link from "next/link";
import { gameModeFromRaw, markerUrl } from "@unicum.gg/shared";
import { CONTROL_POINT, poiUrl } from "@/components/maps/detail/minimap-overlay";
import { TournamentGameMode } from "@unicum.gg/wargaming";
import { ONSLAUGHT_VIEW } from "@/components/maps/detail/views";
import type { Region } from "@unicum.gg/wargaming";
import { MinimapImage } from "@/components/maps/minimap-image";
import ROUTES from "@/constants/routes";
import type { TournamentRecord } from "./record";

/**
 * Which view of the map to open, when the tournament settles it.
 *
 * A map page opens on its first mode and offers the rest as tabs, which is right
 * for a reader arriving from the catalogue. Arriving from a tournament is not
 * that: the tournament names the battle type it is played in, so the map should
 * open showing THAT one's spawns rather than making the reader find the tab.
 *
 * Only when the tournament has a single mode. With several there is no one right
 * view, and picking one would be asserting a mode the tournament never chose, so
 * the link falls back to the map's own default.
 */
function poolViewParam(
  gameModes: TournamentRecord["gameModes"],
): string | undefined {
  if (gameModes.length !== 1) return undefined;
  const mode = gameModes[0]!;
  // Onslaught is not a random-battle mode: it is its own reduced play area, and
  // the viewer keys it separately.
  if (mode === TournamentGameMode.Onslaught) return ONSLAUGHT_VIEW;
  // The random modes' view keys ARE the shared `MapGameMode` values, so the
  // catalogue's own raw-token mapping is the whole translation.
  return gameModeFromRaw(mode) ?? undefined;
}

/** The href a pool entry opens, or null for an arena the catalogue does not
 * carry (which therefore has no page). */
function poolHref(
  region: Region,
  map: TournamentRecord["mapPool"][number],
  view: string | undefined,
): string | null {
  if (!map.slug) return null;
  const href = ROUTES.MAP(region, map.slug);
  return view ? `${href}?view=${view}` : href;
}

/**
 * The pool as a lookup from map NAME to its page, for the places that only have
 * the organiser's text.
 *
 * A match records the maps it was played on as prose ("Cliff, Sand River"), so a
 * bracket card cannot link them on its own. The pool is where those names were
 * already resolved to arenas, and it carries the tournament's battle type, so
 * the index built here sends a bracket's map to exactly the view the map tile
 * beside it opens. Keyed lowercased, since the two spellings come from different
 * fields of the same source.
 */
export function mapHrefIndex(
  region: Region,
  maps: TournamentRecord["mapPool"],
  gameModes: TournamentRecord["gameModes"],
): Map<string, string> {
  const view = poolViewParam(gameModes);
  const out = new Map<string, string>();
  for (const map of maps) {
    const href = poolHref(region, map, view);
    if (map.name && href) out.set(map.name.toLowerCase(), href);
  }
  return out;
}

// The game's own minimap markers, the same ones the map gallery and the match
// minimaps use, so a base reads the same everywhere on the site.
const BASE = { team1: markerUrl("base_ally"), team2: markerUrl("base_enemy") };

const spawn = (team: "team1" | "team2", i: number) =>
  markerUrl(`spawn_${team === "team1" ? "ally" : "enemy"}_${Math.min(i + 1, 4)}`);

/**
 * The battle type's whole geometry, dropped onto the thumbnail: bases, spawns,
 * the contested control point and Onslaught's posts.
 *
 * Small and unlabelled: at this size they say "this is the shape of the map",
 * and the match minimaps put team names on them. It draws the same set as
 * `MatchMinimap` deliberately, since two views of one arena showing different
 * points is the kind of difference a reader reads as a data problem.
 */
function PoolMarkers({ map }: { map: TournamentRecord["mapPool"][number] }) {
  const pins = [
    ...map.bases.team1.map((p) => ({ p, src: BASE.team1 })),
    ...map.bases.team2.map((p) => ({ p, src: BASE.team2 })),
    ...map.spawns.team1.map((p, i) => ({ p, src: spawn("team1", i) })),
    ...map.spawns.team2.map((p, i) => ({ p, src: spawn("team2", i) })),
    ...(map.controlPoint ? [{ p: map.controlPoint, src: CONTROL_POINT }] : []),
    ...map.pointsOfInterest.map((poi) => ({ p: poi.marker, src: poiUrl(poi.type) })),
  ];
  return (
    <div className="pointer-events-none absolute inset-0 transition-transform duration-300 group-hover:scale-105">
      {pins.map(({ p, src }, i) => (
        <Image
          key={i}
          src={src}
          alt=""
          width={16}
          height={16}
          className="absolute -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          style={{ left: `${p.left}%`, top: `${p.top}%` }}
        />
      ))}
    </div>
  );
}

/**
 * The maps a tournament is played on, as a grid of thumbnails.
 *
 * The pool used to be a row of text chips, which named the maps without showing
 * them: a competitor reads a pool to picture the ground, and on a site that
 * already draws every minimap there was no reason to make them go and look.
 * Each tile carries the sides for this tournament's own battle type, so the pool
 * answers "what am I playing, and where does it start" in one pass.
 */
export function TournamentMapPool({
  region,
  maps,
  gameModes,
}: {
  region: Region;
  maps: TournamentRecord["mapPool"];
  /** The tournament's battle types, which decide the view each tile opens. */
  gameModes: TournamentRecord["gameModes"];
}) {
  if (maps.length === 0) return null;
  const view = poolViewParam(gameModes);
  return (
    // Butted together and separated by rules alone, the way a contact sheet
    // reads: the pool is a set of places, and gaps between framed cards made it
    // look like a set of unrelated cards. `auto-fill` rather than fixed
    // breakpoints because this grid renders in a narrow column beside the prize
    // list AND across the full panel when there are no prizes, so the column
    // count has to follow the width it is actually given.
    //
    // It runs edge to edge inside its panel, so the panel's own frame is the
    // grid's outer border: the cells draw the internal rules only (right and
    // bottom), and the whole thing is pulled a pixel right so the last column's
    // rule lands ON the panel's right border rather than a hair inside it,
    // which would read as a double line. The row below the header needs no top
    // rule for the same reason: the header already closed with one.
    <div className="-mr-px grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))]">
      {maps.map((map) => {
        const href = poolHref(region, map, view);
        const tile = (
          <div className="relative aspect-square w-full overflow-hidden bg-fd-muted">
            {map.minimapUrl && (
              <MinimapImage
                src={map.minimapUrl}
                arenaId={map.arenaId}
                alt={`${map.name ?? map.arenaId} minimap`}
                sizes="(max-width: 640px) 45vw, 200px"
                className="transition-transform duration-300 group-hover:scale-105"
              />
            )}
            <PoolMarkers map={map} />
            {/* The name inside the frame, the way the tank hero sits its title
                on the render: below the image it cost a row of its own and
                broke the grid into bands of picture and text.
                The ground under it is a glow anchored on the corner it sits in
                rather than a band across the width, which hid the bottom of
                every map, the part a reader is actually looking at. It is drawn
                on a full-bleed layer so the fade dies out inside the tile with
                no box edge to show, and the shadow on the letters is what
                carries legibility over a snowfield, so the glow can stay
                light. */}
            <span className="pointer-events-none absolute inset-0 bg-radial-[at_0%_100%] from-fd-background/95 from-0% via-fd-background/35 via-30% to-transparent to-55%" />
            <span className="absolute inset-x-0 bottom-0 truncate px-2 pb-1.5 text-xs font-medium [text-shadow:0_1px_3px_var(--color-fd-background),0_0_6px_var(--color-fd-background)] group-hover:text-brand">
              {map.name ?? map.arenaId}
            </span>
          </div>
        );
        const cell =
          "group flex flex-col border-r border-b border-fd-border transition-colors";
        // An arena the map catalogue does not carry has no page to open, so it
        // is a cell rather than a link instead of a link that goes nowhere.
        return href ? (
          <Link key={map.arenaId} href={href} className={cell}>
            {tile}
          </Link>
        ) : (
          <div key={map.arenaId} className={cell}>
            {tile}
          </div>
        );
      })}
    </div>
  );
}
