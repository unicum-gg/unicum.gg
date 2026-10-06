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

/** One vehicle's path, as the endpoint sends it: `[clock ticks, x, z]`. */
type Track = {
  id: number;
  points: [number, number, number][];
  /** The tick it was destroyed, in this same clock, or null if it survived. */
  diedAt: number | null;
  maxHealth: number;
  /** `[tick, hit points]`, one entry per change, implicitly starting at full. */
  health: [number, number][];
};
type Motion = { duration: number; ticksPerSecond: number; tracks: Track[] };

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
      // Clamped, because `requestAnimationFrame` stops while a tab is hidden
      // or busy and then hands back the whole elapsed time at once: a stall of
      // a few seconds otherwise skips minutes of battle and lands on the end,
      // where there is nothing left to draw. A quarter second is longer than
      // any real frame and short enough that a stall costs a stutter rather
      // than the rest of the replay.
      const elapsed = Math.min(now - last, 250);
      const delta = (elapsed / 1000) * SPEED;
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
  // Defaulted, because a browser may still hold a response from before this
  // field existed, whose clocks were in tenths. Reading it as `undefined`
  // turns every comparison into NaN and the map draws no vehicles at all,
  // which is exactly what happened.
  const ticks = motion?.ticksPerSecond || 10;
  // The name rides at the glyph's shoulder, so it follows the same scale. Not
  // below 7px: under that it is a smudge rather than a word, and a smudge on
  // every one of thirty vehicles is worse than no label at all.
  const labelPx = Math.max(7, Math.round(mapWidth * 0.019));
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
              const point = pointAt(track.points, at, ticks);
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
                  <span
                    key={track.id}
                    title={who.player?.nickname ?? String(track.id)}
                    style={{ left: `${where.left}%`, top: `${where.top}%` }}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]",
                      side,
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
                      <span className="relative block">
                        {share !== null && share > 0 ? (
                          <HealthRing share={share} size={markerPx} />
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
                    {who.tank?.shortName ? (
                      <span
                        className={cn(
                          "pointer-events-none absolute left-full top-1/2 whitespace-nowrap font-medium leading-none",
                          side,
                        )}
                        style={{ fontSize: labelPx, paddingLeft: labelPx * 0.3 }}
                      >
                        {who.tank.shortName}
                      </span>
                    ) : null}
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

/**
 * The ring the game draws around a vehicle for the hit points it has left.
 *
 * An arc rather than a bar, because the mark it rings is already a glyph on a
 * crowded map and a bar beside it would be one more thing to disentangle. It
 * runs clockwise from the top, like the game's, and it is coloured by how much
 * is left rather than by side: the side is already said by the glyph inside
 * it, and what a reader wants from a ring is "nearly dead" at a glance.
 */
function HealthRing({ share, size }: { share: number; size: number }) {
  const box = size * 1.45;
  const r = box / 2 - 1;
  const circumference = 2 * Math.PI * r;
  const colour =
    share > 0.6 ? "#4ade80" : share > 0.3 ? "#fbbf24" : "#f87171";
  return (
    <svg
      width={box}
      height={box}
      viewBox={`0 0 ${box} ${box}`}
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
    >
      <circle
        cx={box / 2}
        cy={box / 2}
        r={r}
        fill="none"
        stroke="rgba(0,0,0,0.45)"
        strokeWidth={1.5}
      />
      <circle
        cx={box / 2}
        cy={box / 2}
        r={r}
        fill="none"
        stroke={colour}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray={`${circumference * share} ${circumference}`}
        transform={`rotate(-90 ${box / 2} ${box / 2})`}
      />
    </svg>
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
 * The longest gap, in seconds, worth sliding across.
 *
 * Positions arrive about ten a second, so a normal step is a tenth. Anything
 * much longer is not a vehicle moving slowly, it is a vehicle nobody could
 * see: the stream only carries what the recording client was shown, so a tank
 * that goes unspotted for twenty seconds reappears somewhere else entirely.
 * Sliding across that would draw it gliding through half the map, which is
 * what the first version refused by never interpolating at all.
 */
const SLIDE_LIMIT_S = 1.5;

/**
 * How stale a position may be and still count as "somebody can see this".
 *
 * A spotted vehicle sends about ten positions a second, and it keeps sending
 * them while standing still: measured on one battle, a third of a track's
 * segments move less than half a metre, so silence means lost sight of rather
 * than stopped. The split is clean rather than arbitrary, which is why the
 * exact second matters so little: a third of the battle falls in long gaps at
 * a half-second threshold and still a third at three seconds. Gaps are either
 * a tenth of a second or they are tens of them.
 */
const SPOT_GAP_S = 1;

/**
 * Where a vehicle was at `at` seconds, between its two nearest samples.
 *
 * Interpolated, because the samples are half a second apart and stepping
 * between them reads as a stutter rather than as movement. Straight-line
 * between two points 8 m apart is a very good approximation of a tank's path;
 * it is only across a long gap that it becomes a lie, which `SLIDE_LIMIT`
 * refuses.
 */
/**
 * The share of its hit points a vehicle still had at `at`, from 0 to 1.
 *
 * The last value the recording client was told, not an interpolation: health
 * does not drift, it drops when a shell lands. Full until the first change,
 * which is why the series can be empty for a vehicle that was never hit.
 */
function healthAt(track: Track, at: number, ticks: number): number | null {
  if (!track.maxHealth) return null;
  const now = at * ticks;
  let hp = track.maxHealth;
  for (const [when, value] of track.health) {
    if (when > now) break;
    hp = value;
  }
  return Math.max(0, Math.min(1, hp / track.maxHealth));
}

/** Where a vehicle is, and whether anyone can currently see it there. */
type Seen = { x: number; z: number; spotted: boolean };

function pointAt(
  points: [number, number, number][],
  at: number,
  ticks: number,
): Seen | null {
  const now = at * ticks;
  let before: [number, number, number] | null = null;
  let after: [number, number, number] | null = null;
  for (const point of points) {
    if (point[0] <= now) before = point;
    else {
      after = point;
      break;
    }
  }
  if (!before) return null;
  // Nothing after it: the recording holds no more of this vehicle, so this is
  // where it was last seen and not where it is.
  if (!after) return { x: before[1], z: before[2], spotted: false };

  const span = after[0] - before[0];
  const spotted = span > 0 && span <= SPOT_GAP_S * ticks;
  if (!spotted || span > SLIDE_LIMIT_S * ticks) {
    return { x: before[1], z: before[2], spotted };
  }
  const k = (now - before[0]) / span;
  return {
    x: before[1] + (after[1] - before[1]) * k,
    z: before[2] + (after[2] - before[2]) * k,
    spotted,
  };
}
