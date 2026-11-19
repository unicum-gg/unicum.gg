"use client";

import { projectPoint } from "@unicum.gg/shared";
import { Hint } from "@/components/hint";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import type { Participant } from "./battle-types";
import type { Bounds, Track } from "./replay-types";
import { aimAt, healthAt, pathOf, pointAt } from "./replay-math";
import { HealthRing, ringOverflow } from "./replay-health-ring";

/** Every vehicle on the map at this moment: its glyph, its ring, its gun. */
export function VehicleLayer({
  tracks,
  byId,
  ourTeam,
  highlightAccount,
  recorderTeam,
  at,
  ticks,
  startsAt,
  bounds,
  markerPx,
  labelPx,
  mapPx,
  setFocus,
}: {
  tracks: Track[];
  byId: Map<number, Participant>;
  ourTeam: number;
  highlightAccount?: number;
  /** The recorder's side, whose vehicles are never out of sight. */
  recorderTeam: number | null;
  at: number;
  ticks: number;
  startsAt: number;
  bounds: Bounds;
  markerPx: number;
  labelPx: number;
  /** The map's drawn width, to keep the names inside it. */
  mapPx: number;
  /** Read the battle as this account's. */
  setFocus: (account: number) => void;
}) {
  const { t } = useTranslation("components/players/detail/overview/battles");
  return (
    <>
      {tracks.map((track) => {
          const who = byId.get(track.id);
          // Only what we can name. The packet stream carries more than
          // vehicles: on Onslaught the five capturable objectives and the
          // control point are world entities with ids of their own, and
          // they sit in the stream exactly like a tank would. Drawn
          // blindly they became red dots pinned on every objective,
          // because a track with no participant falls through the team
          // test into the enemy colour. Verified on a real battle: six
          // such tracks, five landing at 0.00% from a declared objective.
          if (!who) return null;
          const point = pointAt(
            pathOf(track),
            at,
            ticks,
            startsAt,
            who.team === recorderTeam,
          );
          if (!point) return null;
          // x and z only: the minimap is a plan view, and a tank on a hill
          // is at the same place on it as one under the hill.
          const where = projectPoint({ x: point.x, z: point.z }, bounds);
          const mine =
            who.account !== undefined && who.account === highlightAccount;
          // Dead is read off the battle's own account of who survived,
          // not off the track running out: a wreck keeps reporting for
          // several seconds, and a vehicle that simply went unspotted
          // stops reporting without having died at all.
          const dead = track.diedAt !== null && at * ticks >= track.diedAt;
          // Dimmed, not greyed. A flat grey says "dead" and loses the one
          // thing still worth reading off a wreck, which is whose it was:
          // six dead allies and six dead enemies in the same colour tell
          // you a lot less than where each side lost them. So the side
          // keeps its colour and only its strength goes.
          const full = mine
            ? "text-amber-300"
            : who.team === ourTeam
              ? "text-emerald-400"
              : "text-red-400";
          const faded = mine
            ? "text-amber-300/40"
            : who.team === ourTeam
              ? "text-emerald-400/40"
              : "text-red-400/40";
          const side = dead ? faded : full;
          const share = dead ? 0 : healthAt(track, at, ticks);
          return (
              <Hint
                key={track.id}
                content={
                  point.estimated
                    ? `${who.player?.nickname ?? track.id} · ${t("replay.estimated")}`
                    : (who.player?.nickname ?? String(track.id))
                }
              >
                <span
                  style={{ left: `${where.left}%`, top: `${where.top}%` }}
                  onClick={() => who.account !== undefined && setFocus(who.account)}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]",
                    side,
                    // Out of the recording's reach: drawn where it most
                    // likely was, faded, since nobody actually saw it there.
                    point.estimated && !dead && "opacity-40",
                  )}
                >
                  {!dead && !point.spotted ? (
                    // Alive but out of sight: a bare dot at the last place
                    // it was seen, as the game draws it. The name stays,
                    // because the question a reader has about a dot on the
                    // far side of the map is which tank it was.
                    //
                    // A destroyed vehicle keeps its glyph instead, faded.
                    // The two states are different claims: a dot says
                    // nobody knows where this tank is now, a faded glyph
                    // says this is exactly where it stopped.
                    <span
                      className="block rounded-full bg-current opacity-70 ring-1 ring-black/60"
                      style={{ width: markerPx * 0.42, height: markerPx * 0.42 }}
                    />
                  ) : who.tank?.type ? (
                    // The game's own class glyph, which is what a player
                    // reads a minimap by: a heavy and a scout at the same
                    // spot mean very different things, and two identical
                    // discs say neither.
                    //
                    // The side colour goes ON the icon, not on this span:
                    // the component sets a colour of its own inside, so a
                    // parent's `text-…` never reaches the glyph and every
                    // tank came out the same pale grey.
                    <span
                      // Sized to the glyph exactly, so the ring has a square
                      // to centre on. Left to its own devices the box is an
                      // inline one and carries the baseline's descender
                      // space below the icon, which pushes the ring up by a
                      // couple of pixels and reads as crooked.
                      // `flex`, not `block`: the icon is an inline-flex
                      // element, so in a block box it sits on a baseline and
                      // the ring, centred on the box, came out two pixels
                      // high on every vehicle. A flex child has no baseline
                      // to sit on.
                      className="relative flex items-center justify-center"
                      style={{ width: markerPx, height: markerPx }}
                    >
                      {/* Where the gun points, from the glyph's centre:
                          the hull's heading plus the turret's angle on it,
                          as the recording was told. Only for a tank alive
                          and in sight, since an angle heard a minute ago
                          says nothing about where it aims now. */}
                      {!dead && point.spotted && !point.estimated && !point.far ? (() => {
                        const aim = aimAt(track, at, ticks);
                        return aim === null ? null : (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute bottom-1/2 left-1/2 origin-bottom bg-current opacity-80"
                            style={{
                              width: Math.max(1, Math.round(markerPx * 0.12)),
                              height: markerPx * (mine ? 2.2 : 1.6),
                              transform: `translateX(-50%) rotate(${aim}rad)`,
                            }}
                          />
                        );
                      })() : null}
                      {share !== null && share > 0 ? (
                        <HealthRing
                          share={share}
                          size={markerPx}
                          className={side}
                        />
                      ) : null}
                      <VehicleTypeIcon
                        type={who.tank.type}
                        size={markerPx}
                        className={side}
                      />
                    </span>
                  ) : (
                    // A vehicle whose class we do not hold: still drawn,
                    // because where it was is the point, and a missing
                    // catalogue entry is no reason to lose it off the map.
                    <span
                      className="block rounded-full bg-current ring-1 ring-black/50"
                      style={{ width: markerPx * 0.5, height: markerPx * 0.5 }}
                    />
                  )}
                  {/* The tank's name beside its glyph, where the game puts
                      it. Absolutely positioned out of the marker's own box
                      so it cannot push the glyph off the point it marks,
                      and never wrapped: a name that folds onto two lines
                      over a minimap is unreadable either way. */}
                  {who.tank?.shortName ? (() => {
                    // Kept inside the map: a name that would run past the
                    // right edge goes on the left of its glyph, and one at
                    // the very top or bottom goes under or over it instead of
                    // being cut in half. The width is estimated from the
                    // name's length, since measuring thirty labels every
                    // frame is not worth what it buys.
                    const name = who.tank.shortName;
                    // Clear of the hit-point ring, which reaches past the
                    // glyph's box; a dot or a wreck has none to clear.
                    const clear = share !== null && share > 0 ? ringOverflow(markerPx) : 0;
                    const width = ((name.length * labelPx * 0.58 + markerPx + clear) / mapPx) * 100;
                    const flip = where.left + width > 100;
                    const edge = (labelPx * 1.2 + markerPx / 2 + clear) / mapPx * 100;
                    const vertical = where.top < edge ? "below" : where.top > 100 - edge ? "above" : null;
                    return (
                      <span
                        className={cn(
                          "pointer-events-none absolute whitespace-nowrap font-medium leading-none",
                          vertical === "below"
                            ? "top-full"
                            : vertical === "above"
                              ? "bottom-full"
                              : "top-1/2 -translate-y-1/2",
                          vertical
                            ? flip
                              ? "right-0"
                              : "left-0"
                            : flip
                              ? "right-full"
                              : "left-full",
                          side,
                        )}
                        style={{
                          fontSize: labelPx,
                          ...(vertical
                            ? { [vertical === "below" ? "paddingTop" : "paddingBottom"]: clear + labelPx * 0.2 }
                            : { [flip ? "paddingRight" : "paddingLeft"]: clear + labelPx * 0.3 }),
                        }}
                      >
                        {name}
                      </span>
                    );
                  })() : null}
              </span>
              </Hint>
          );
        })}
    </>
  );
}
