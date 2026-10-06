"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { PlayIcon, PauseIcon, FilmSlateIcon } from "@phosphor-icons/react";
import type { TranslateFunction } from "@onruntime/translations";
import type { Region } from "@unicum.gg/wargaming";
import { minimapUrl, projectPoint } from "@unicum.gg/shared";
import { MinimapImage } from "@/components/maps/minimap-image";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { unicum } from "@/services/sdk";
import { cn } from "@/lib/utils";
import { Overlay } from "@/components/maps/detail/minimap-overlay";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import type { MapOverlay, Participant } from "./battle-types";

type Bounds = {
  bottomLeft: { x: number; z: number };
  upperRight: { x: number; z: number };
};

/** One vehicle's path, as the endpoint sends it: `[tenths of a second, x, z]`. */
type Track = { id: number; points: [number, number, number][] };
type Motion = { duration: number; hz: number; tracks: Track[] };

/** How fast the drawing advances while playing, in battle seconds per second. */
const SPEED = 4;

/**
 * The capture circle, in metres across.
 *
 * A base is captured from within 50 m of its flag, so the ring is 100 m wide.
 * Drawn to the map's real scale rather than a fixed pixel size, which is what
 * makes it register 1:1 with the minimap and with the tanks standing in it.
 */
const CAPTURE_DIAMETER_M = 100;

/**
 * The minimap width the shared overlay's icon sizes were chosen against.
 *
 * They are plain pixels, picked while looking at the map detail page, which
 * draws its minimap around this wide on a desktop. This viewer's map is half
 * that, so at scale 1 a spawn marker covers 11% of it where it covers 6% over
 * there, which is exactly the "far too big" it looks. Measured, not guessed:
 * 58 px on a 926 px map against 58 px on a 512 px one.
 *
 * So the icons are scaled by this map's own measured width over that
 * reference, which keeps them the same fraction of the image at any size,
 * including on a phone.
 */
const OVERLAY_REFERENCE_WIDTH = 926;

/**
 * The battle replayed on its own minimap, out of the archived replay.
 *
 * It reads the **decoded positions**, not the file: a few hundred kilobytes
 * instead of 1.3 MB, and it never puts the packet stream in a browser, which
 * carries the battle chat among everything else the client saw.
 *
 * Three states and no fourth. Either the archive has this battle's replay and
 * it draws, or it is being fetched, or there is none. There is nothing for the
 * reader to do about the last one, so it says so plainly rather than offering
 * an action: the file only exists when the player who was there had recording
 * on, and that is not a thing anyone reading the page can change.
 *
 * What it adds over watching the file in the game: the roster is resolved, so
 * a dot carries the name, the clan and the battle rating of whoever it was.
 */
export function BattleReplay({
  region,
  battleId,
  arenaId,
  hasReplay,
  mapImage,
  bounds,
  overlay,
  participants,
  highlightAccount,
  t,
}: {
  region: Region;
  battleId: string;
  arenaId: string;
  hasReplay: boolean;
  mapImage: string | null;
  bounds: Bounds | null;
  overlay: MapOverlay | null;
  participants: Participant[];
  highlightAccount?: number;
  t: TranslateFunction;
}) {
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frame = useRef<number | null>(null);
  const map = useRef<HTMLDivElement | null>(null);
  const [mapWidth, setMapWidth] = useState(0);

  // Measured rather than assumed: the container is fluid under its max width,
  // so a phone gets a much smaller map and the icons have to follow it.
  useEffect(() => {
    const node = map.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(([entry]) =>
      setMapWidth(entry.contentRect.width),
    );
    watch.observe(node);
    return () => watch.disconnect();
  });

  // Through the SDK like every other read on this page: a hand-written fetch
  // against our own API is the one thing this repo does not allow, because the
  // response type would stop being generated from the served spec.
  const request = () => unicum.region(region).battles(battleId).replay();
  const { data, isLoading, error } = useSWR(
    hasReplay ? request().url() : null,
    () => request().then((r) => r as unknown as Motion),
    { revalidateOnFocus: false },
  );
  const motion = data ?? null;

  // Not derived from a `state` variable: the three answers are exactly what
  // SWR already knows, and keeping a second copy of them is how they drift.
  const missing = !hasReplay || (!isLoading && !error && !motion?.tracks.length);

  useEffect(() => {
    // Start playing once, when a replay first lands, and not on every render.
    if (motion && motion.tracks.length > 0) {
      setAt(0);
      setPlaying(true);
    }
  }, [motion]);

  useEffect(() => {
    if (!playing || !motion) return;
    let last = performance.now();
    const step = (now: number) => {
      const delta = ((now - last) / 1000) * SPEED;
      last = now;
      setAt((previous) => {
        const next = previous + delta;
        if (next >= motion.duration) {
          setPlaying(false);
          return motion.duration;
        }
        return next;
      });
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [playing, motion]);

  if (missing) return <Notice>{t("replay.none")}</Notice>;
  if (isLoading) return <Notice>{t("replay.loading")}</Notice>;
  if (error || !motion) return <Notice>{t("replay.failed")}</Notice>;

  const byId = new Map(participants.map((p) => [p.id, p]));
  // Green is "on my side", not "team 1". The team numbers are the game's own
  // and say nothing about who is reading the page: this battle had the page's
  // player in team 2, so colouring by the raw number painted his own six
  // team-mates as the enemy. Falls back to team 1 when the page belongs to
  // nobody in the battle, which is the only case with no side to take.
  // Scaled with the map for the reason the overlay's markers are: a fixed
  // pixel glyph that reads well at 512 swamps a phone's map.
  const markerPx = Math.max(9, Math.round((mapWidth || 512) * 0.032));
  const ourTeam =
    participants.find((p) => p.account !== undefined && p.account === highlightAccount)
      ?.team ?? 1;

  return (
    <div className="space-y-3 px-4 py-3">
      <div
        ref={map}
        className="relative mx-auto aspect-square w-full max-w-lg overflow-hidden rounded"
      >
        <MinimapImage
          src={mapImage ?? minimapUrl(arenaId)}
          arenaId={arenaId}
          alt={arenaId}
          sizes="512px"
          className="h-full w-full object-cover"
        />
        {/* The mode's own flags, spawns and capture circles, the same drawing
            the map page makes, from the same component. Under the vehicles on
            purpose: a tank standing on a base should read as on top of it. */}
        {overlay ? (
          <Overlay
            geometry={{
              bases: overlay.bases,
              spawns: overlay.spawns,
              controlPoint: overlay.controlPoint,
              pois: overlay.pois,
            }}
            capX={(CAPTURE_DIAMETER_M / overlay.widthMeters) * 100}
            capY={(CAPTURE_DIAMETER_M / overlay.heightMeters) * 100}
            mapWidth={overlay.widthMeters}
            mapHeight={overlay.heightMeters}
            scale={(mapWidth || OVERLAY_REFERENCE_WIDTH) / OVERLAY_REFERENCE_WIDTH}
          />
        ) : null}
        {bounds
          ? motion.tracks.map((track) => {
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
              const point = pointAt(track.points, at);
              if (!point) return null;
              // x and z only: the minimap is a plan view, and a tank on a hill
              // is at the same place on it as one under the hill.
              const where = projectPoint({ x: point[0], z: point[1] }, bounds);
              const mine =
                who.account !== undefined && who.account === highlightAccount;
              const side = mine
                ? "text-amber-300"
                : who.team === ourTeam
                  ? "text-emerald-400"
                  : "text-red-400";
              return (
                  <span
                    key={track.id}
                    title={who.player?.nickname ?? String(track.id)}
                    style={{ left: `${where.left}%`, top: `${where.top}%` }}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]",
                      side,
                    )}
                  >
                    {who.tank?.type ? (
                      // The game's own class glyph, which is what a player
                      // reads a minimap by: a heavy and a scout at the same
                      // spot mean very different things, and two identical
                      // discs say neither.
                      //
                      // The side colour goes ON the icon, not on this span:
                      // the component sets a colour of its own inside, so a
                      // parent's `text-…` never reaches the glyph and every
                      // tank came out the same pale grey.
                      <VehicleTypeIcon
                        type={who.tank.type}
                        size={markerPx}
                        className={side}
                      />
                    ) : (
                      // A vehicle whose class we do not hold: still drawn,
                      // because where it was is the point, and a missing
                      // catalogue entry is no reason to lose it off the map.
                      <span
                        className="block rounded-full bg-current ring-1 ring-black/50"
                        style={{ width: markerPx * 0.5, height: markerPx * 0.5 }}
                      />
                    )}
                  </span>
              );
            })
          : null}
      </div>

      <div className="mx-auto flex max-w-lg items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? t("replay.pause") : t("replay.play")}
        >
          {playing ? (
            <PauseIcon className="size-4" />
          ) : (
            <PlayIcon className="size-4" />
          )}
        </Button>
        <Slider
          value={[at]}
          min={0}
          max={Math.max(1, motion.duration)}
          step={0.5}
          onValueChange={([value]) => {
            setPlaying(false);
            setAt(value);
          }}
          className="flex-1"
        />
        <span className="text-muted-foreground w-16 text-end text-sm tabular-nums">
          {clock(at)} / {clock(motion.duration)}
        </span>
      </div>

      {!bounds ? (
        <p className="text-muted-foreground text-center text-xs">
          {t("replay.no-bounds")}
        </p>
      ) : null}
    </div>
  );
}

/** The one shape every state that is not a drawing takes. */
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-10 text-center">
      <FilmSlateIcon className="size-6 opacity-60" />
      <p className="max-w-prose text-sm">{children}</p>
    </div>
  );
}

function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * The longest gap, in tenths of a second, worth sliding across.
 *
 * Positions arrive twice a second, so a normal step is 5. Anything much
 * longer is not a vehicle moving slowly, it is a vehicle nobody could see:
 * the stream only carries what the recording client was shown, so a tank that
 * goes unspotted for twenty seconds reappears somewhere else entirely. Sliding
 * across that would draw it gliding through half the map, which is the thing
 * the first version of this refused to do by never interpolating at all.
 */
const SLIDE_LIMIT = 15;

/**
 * Where a vehicle was at `at` seconds, between its two nearest samples.
 *
 * Interpolated, because the samples are half a second apart and stepping
 * between them reads as a stutter rather than as movement. Straight-line
 * between two points 8 m apart is a very good approximation of a tank's path;
 * it is only across a long gap that it becomes a lie, which `SLIDE_LIMIT`
 * refuses.
 */
function pointAt(
  points: [number, number, number][],
  at: number,
): [number, number] | null {
  const tenths = at * 10;
  let before: [number, number, number] | null = null;
  let after: [number, number, number] | null = null;
  for (const point of points) {
    if (point[0] <= tenths) before = point;
    else {
      after = point;
      break;
    }
  }
  if (!before) return null;
  if (!after) return [before[1], before[2]];
  const span = after[0] - before[0];
  if (span <= 0 || span > SLIDE_LIMIT) return [before[1], before[2]];
  const k = (tenths - before[0]) / span;
  return [
    before[1] + (after[1] - before[1]) * k,
    before[2] + (after[2] - before[2]) * k,
  ];
}
