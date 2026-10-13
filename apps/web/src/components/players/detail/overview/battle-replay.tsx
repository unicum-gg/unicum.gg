"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/hooks/use-translation";
import type { CSSProperties } from "react";
import useSWR from "swr";
import { PlayIcon, PauseIcon, FilmSlateIcon } from "@phosphor-icons/react";
import type { TranslateFunction } from "@onruntime/translations";
import type { Region } from "@unicum.gg/wargaming";
import {
  DEATH_MESSAGE_CODE,
  minimapUrl,
  projectPoint,
} from "@unicum.gg/shared";
import { MinimapImage } from "@/components/maps/minimap-image";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { unicum } from "@/services/sdk";
import { cn } from "@/lib/utils";
import { Overlay } from "@/components/maps/detail/minimap-overlay";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import type { MapOverlay, Participant } from "./battle-types";
import { Hint } from "@/components/hint";

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
/** One line somebody typed, as the endpoint hands it over: plain text, never markup. */
type ChatLine = {
  at: number;
  from: string;
  vehicle: string | null;
  text: string;
  ally: boolean;
  /** Set when the line is a quick command rather than something typed. */
  command?: string | null;
  /** The sender's vehicle id for a command, to resolve against `byId`. */
  sender?: number | null;
  /** Where the command pinged, in the arena's metres, or null for most of them. */
  where?: { x: number; z: number } | null;
  /** The vehicle the command is about, for `%(target)s`. */
  target?: number | null;
  /** Seconds left on a reload, for `%(reloadTime)d`. */
  reloadTime?: number | null;
  /** A base or objective label, for `%(strArg1)s`. */
  label?: string | null;
};

/** One vehicle destroyed, with whoever did it where the recording heard who. */
type Death = {
  at: number;
  victim: number;
  by: number | null;
  damage: number | null;
  /** The game's own `deathReason`, which picks the sentence. */
  reason?: number | null;
};

type Motion = {
  duration: number;
  ticksPerSecond: number;
  /** The tick the countdown ends; before it nothing moves and all is visible. */
  startsAt: number;
  tracks: Track[];
  /** Optional, because a browser may hold an answer from before this existed. */
  chat?: ChatLine[];
  deaths?: Death[];
};

/** How fast the drawing advances while playing, in battle seconds per second. */
const SPEED = 4;

/**
 * How long a ping stays on the map, in seconds.
 *
 * The game's own cooldown for repeating a command, which is also about as long
 * as its marker lives. Long enough to be caught while scrubbing, short enough
 * that a busy minute does not become a field of rings.
 */
const PING_LIFE = 5;



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
  // The whole instrument, so the chat beside it can be exactly as tall.
  const panel = useRef<HTMLDivElement | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);

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

  // The instrument's real height, measured rather than added up from the map
  // plus a guess at the strip and the transport: that guess was twenty pixels
  // short and the two panels did not line up. No loop, because the chat is
  // capped AT this height and so can never be what sets it.
  useEffect(() => {
    const node = panel.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(([entry]) =>
      setPanelHeight(entry.contentRect.height),
    );
    watch.observe(node);
    return () => watch.disconnect();
  });

  // Through the SDK like every other read on this page: a hand-written fetch
  // against our own API is the one thing this repo does not allow, because the
  // response type would stop being generated from the served spec.
  const request = () => unicum.region(region).battles(battleId).replay();
  // Hoisted: it is this read's cache key AND the identity of the replay
  // currently on screen, which the reset below compares against. `.url()`
  // is side-effect-free by contract, so naming it costs nothing.
  const key = hasReplay ? request().url() : null;
  const { data, isLoading, error } = useSWR(
    key,
    () => request().then((r) => r as unknown as Motion),
    { revalidateOnFocus: false },
  );
  const motion = data ?? null;

  // Not derived from a `state` variable: the three answers are exactly what
  // SWR already knows, and keeping a second copy of them is how they drift.
  const missing = !hasReplay || (!isLoading && !error && !motion?.tracks.length);

  // Back to the start, and playing, once per replay that lands.
  //
  // Adjusted during render rather than in an effect, which is the pattern
  // React documents for state that has to follow a prop. An effect would run
  // after the browser had already painted, so opening a second battle drew
  // one frame at the previous one's clock before snapping back to zero, and
  // the cascading render that causes is what `react-hooks/set-state-in-effect`
  // is pointing at.
  const [startedFor, setStartedFor] = useState<string | null>(null);
  if (key && motion && motion.tracks.length > 0 && startedFor !== key) {
    setStartedFor(key);
    setAt(0);
    setPlaying(true);
  }

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

  // When each vehicle died, for the rosters: the battle's own account, so a
  // tank nobody watched die still greys out at the right moment.
  //
  // Above the early returns, with every other hook. Sitting below them, it ran
  // on some renders and not others, and React counts hooks rather than naming
  // them: "rendered more hooks than during the previous render". `motion?.` is
  // what lets it live here, since up here there may not be one yet.
  const diedAt = useMemo(
    () =>
      new Map(
        (motion?.deaths ?? [])
          .filter((death) => death.at !== null)
          .map((death) => [death.victim, death.at]),
      ),
    [motion],
  );

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
    <div className="px-4 py-3">
      {/* One instrument, not three widgets. The strip, the map and the transport
          are a single column of one width, because they are one reading: how
          the battle stands, where everyone is, and when. The chat sits beside
          it at the same height. Below `lg` the column takes the full width and
          the chat goes under it, where a column next to a square map would
          leave neither of them readable. */}
      {/* The map keeps its size and the two columns take everything else,
          sharing it equally. They were fixed at 208px, which was too narrow for
          a long nickname and broke it across two lines. */}
      <div className="flex flex-col items-center gap-3 lg:flex-row lg:items-stretch">
      <ChatColumn
        lines={motion.chat ?? []}
        byId={byId}
        bounds={bounds}
        ourTeam={ourTeam}
        roster={participants.filter((one) => one.team === ourTeam)}
        diedAt={diedAt}
        highlightAccount={highlightAccount}
        at={at}
        ticks={ticks}
        height={panelHeight}
        t={t}
      />
      <div
        ref={panel}
        className="border-border bg-background/40 flex w-full max-w-lg shrink-0 flex-col overflow-hidden rounded-lg border"
      >
      <TeamStrip
        tracks={motion.tracks}
        byId={byId}
        ourTeam={ourTeam}
        highlightAccount={highlightAccount}
        at={at}
        startsAt={motion.startsAt}
        ticks={ticks}
        t={t}
      />
      <div
        ref={map}
        className="relative aspect-square w-full overflow-hidden"
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
        {/* The pings, under the vehicles: a marker is a place somebody
            pointed at, and a tank standing on it should read as on top of it,
            the same way the bases do. */}
        {bounds
          ? (motion.chat ?? []).map((line, index) => {
              if (!line.where) return null;
              const age = at - line.at / ticks;
              if (age < 0 || age > PING_LIFE) return null;
              const where = projectPoint(line.where, bounds);
              const who = line.sender != null ? byId.get(line.sender) : undefined;
              const ally = who ? who.team === ourTeam : true;
              // Fades over its life rather than vanishing, because a ping that
              // blinks out mid-scrub reads as a glitch, and because the fading
              // is itself the clue that it was a moment and not a place.
              const left = 1 - age / PING_LIFE;
              return (
                <span
                  key={`ping-${line.at}-${index}`}
                  className={cn(
                    "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
                    ally ? "border-emerald-300" : "border-red-300",
                  )}
                  style={{
                    left: `${where.left}%`,
                    top: `${where.top}%`,
                    width: markerPx * 1.6,
                    height: markerPx * 1.6,
                    opacity: 0.25 + 0.6 * left,
                  }}
                />
              );
            })
          : null}
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
              const point = pointAt(track.points, at, ticks, motion.startsAt ?? 0);
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
                    content={who.player?.nickname ?? String(track.id)}
                  >
                    <span
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
                  </Hint>
              );
            })
          : null}
      </div>

      <div className="flex items-center gap-3 px-3 py-2">
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
        <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
          {clock(at)}
          <span className="text-muted-foreground/50"> / {clock(motion.duration)}</span>
        </span>
      </div>
      </div>
      <Timeline
        deaths={motion.deaths ?? []}
        byId={byId}
        ourTeam={ourTeam}
        roster={participants.filter((one) => one.team !== ourTeam)}
        diedAt={diedAt}
        highlightAccount={highlightAccount}
        at={at}
        ticks={ticks}
        height={panelHeight}
        t={t}
      />
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
 * runs clockwise from the top, like the game's, and it takes the SIDE's own
 * colour, so only the arc's length says how much is left.
 *
 * It was coloured by the share at first, green above 60% and red below 30%,
 * which read as the opposite of what it meant: those two are the side
 * colours themselves (`emerald-400` and `red-400`), so a healthy enemy drew
 * an ally-green ring and a wounded ally drew an enemy-red one. Colour here
 * is spoken for, and length was free.
 */
function HealthRing({
  share,
  size,
  className,
}: {
  share: number;
  size: number;
  /** The side's colour class, which the stroke reads as `currentColor`. */
  className?: string;
}) {
  // Thick enough to read at a glance on a busy map, and proportional like
  // everything else here so it holds up on a phone's smaller one.
  const stroke = Math.max(2, Math.round(size * 0.17));
  // Whole pixels, and an even difference from the glyph's box, so the offset
  // below is an integer: centring by `left: 50%` and a half translate lands on
  // a fraction of a pixel that the browser rounds, which drew the ring one
  // pixel high on every vehicle.
  const box = size + 2 * Math.round(size * 0.28);
  // The radius is to the stroke's CENTRE, so half of it has to come off or a
  // thicker ring grows outwards and clips against the viewBox.
  const r = (box - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <svg
      width={box}
      height={box}
      viewBox={`0 0 ${box} ${box}`}
      aria-hidden
      className={cn("pointer-events-none absolute", className)}
      // Exact arithmetic against the parent, which is the glyph's own square:
      // the overhang is the same whole number of pixels on all four sides.
      style={{ left: (size - box) / 2, top: (size - box) / 2 }}
    >
      <circle
        cx={box / 2}
        cy={box / 2}
        r={r}
        fill="none"
        stroke="rgba(0,0,0,0.55)"
        strokeWidth={stroke}
      />
      <circle
        cx={box / 2}
        cy={box / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="butt"
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
/**
 * A feed sentence with its two names put back, each in its side's colour.
 *
 * The client writes `%(attacker)s destroyed %(target)s.` and fills both holes
 * with a name it has already coloured. Splitting on the holes rather than
 * replacing into a string is what lets each name carry its own colour and its
 * vehicle, and it keeps a player's own characters out of anything but a text
 * node.
 */
function named(
  text: string,
  parts: {
    at: string;
    who: { name: string | null; tank: string | null } | null;
  }[],
) {
  const pattern = /%\((attacker|target)\)s/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const part = parts.find((one) => one.at === match![1]);
    out.push(
      <span key={`n${key++}`} className="inline-block">
        <span className="font-medium">{part?.who?.name ?? "?"}</span>
        {part?.who?.tank ? (
          <span className="opacity-70">{` (${part.who.tank})`}</span>
        ) : null}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  // No colour of its own: the line above it already carries the one verdict.
  return <>{out}</>;
}

/**
 * One team, listed as the game's own panel lists it.
 *
 * Allies above the chat on the left, enemies above the timeline on the right,
 * which is the arrangement the client itself uses: `AllySortedIDsComposer`
 * fills `leftItemsIDs` and the enemy one fills `rightItemsIDs`.
 *
 * The order is the client's `VehicleInfoSortKey`: the living before the dead,
 * then tier DESCENDING, then class, then the vehicle's name, then the player's.
 * Sorted every frame rather than once, because the first of those keys is
 * exactly what the clock changes, and a roster whose wrecks sink to the bottom
 * as the battle goes is most of what this list is for.
 */
function Roster({
  side,
  diedAt,
  highlightAccount,
  ally,
  at,
  ticks,
}: {
  side: Participant[];
  diedAt: Map<number, number>;
  highlightAccount?: number;
  ally: boolean;
  at: number;
  ticks: number;
}) {
  const now = at * ticks;
  const rows = useMemo(() => {
    const dead = (one: Participant) => {
      const when = diedAt.get(one.id);
      return when !== undefined && now >= when;
    };
    return [...side].sort(
      (a, b) =>
        Number(dead(a)) - Number(dead(b)) ||
        (b.tank?.tier ?? 0) - (a.tank?.tier ?? 0) ||
        classRank(a.tank?.type ?? null) - classRank(b.tank?.type ?? null) ||
        (a.tank?.shortName ?? "").localeCompare(b.tank?.shortName ?? "") ||
        (a.player?.nickname ?? "").localeCompare(b.player?.nickname ?? ""),
    );
  }, [side, diedAt, now]);

  if (rows.length === 0) return null;
  return (
    // Hairlines between the rows rather than more air: fourteen names in a
    // column need a edge to scan down, and spacing alone made them one block.
    <ul className="border-border/50 divide-border/30 flex flex-col divide-y border-b text-xs">
      {rows.map((one) => {
        const when = diedAt.get(one.id);
        const dead = when !== undefined && now >= when;
        const mine =
          one.account !== undefined && one.account === highlightAccount;
        return (
          <li
            key={one.id}
            className={cn(
              "flex min-w-0 items-center gap-1.5 px-3 py-1",
              // Dimmed rather than struck through or greyed: the side is still
              // worth reading off a wreck, and it is the one thing a flat grey
              // would take away.
              dead && "opacity-40",
              // The reader's own row, lifted out of the list the way the game
              // lifts it: they look for themselves first.
              mine && "bg-amber-300/5",
            )}
          >
            {one.tank?.type ? (
              <VehicleTypeIcon
                type={one.tank.type}
                size={12}
                className={
                  mine
                    ? "text-amber-300"
                    : ally
                      ? "text-emerald-400"
                      : "text-red-400"
                }
              />
            ) : (
              <span className="size-3 shrink-0" />
            )}
            <span
              className={cn(
                "min-w-0 truncate font-medium",
                mine
                  ? "text-amber-300"
                  : ally
                    ? "text-emerald-400"
                    : "text-red-400",
              )}
            >
              {one.player?.nickname ?? "?"}
              {/* The clan in the game's own brackets, dimmed against the name:
                  it is how a player is recognised, not a second name. */}
              {one.player?.clanTag ? (
                <span className="opacity-60">{`[${one.player.clanTag}]`}</span>
              ) : null}
            </span>
            <span className="text-muted-foreground/60 ml-auto shrink-0 truncate">
              {one.tank?.shortName ?? ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Who died, and to whom, as the clock reaches each one.
 *
 * The mirror of the chat on the other side of the map: the same panel, the same
 * height, the same reveal. What it shows is the battle's other running story,
 * and the two together are most of what a replay is for.
 *
 * **Its two halves come from different places and that is deliberate.** The
 * instant is the battle's own results, which know about a tank nobody watched
 * die; the killer is the recording, which only speaks for what that client
 * could see. So a row with no killer is not a gap in the data, it is a death
 * that happened out of sight, and it says so by naming only the victim.
 */
function Timeline({
  deaths,
  byId,
  ourTeam,
  roster,
  diedAt,
  highlightAccount,
  at,
  ticks,
  height,
  t,
}: {
  deaths: Death[];
  byId: Map<number, Participant>;
  ourTeam: number;
  /** This side's players, listed above the column as the game lists them. */
  roster: Participant[];
  /** When each vehicle died, for greying the roster as the clock passes. */
  diedAt: Map<number, number>;
  /** The page's own player, whom the game words differently: "Vehicle was…". */
  highlightAccount?: number;
  at: number;
  ticks: number;
  height: number;
  t: TranslateFunction;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const now = at * ticks;
  const done = deaths.filter((death) => death.at <= now);

  useEffect(() => {
    const node = box.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [done.length]);

  // The battle feed's own sentence for a destruction, which a replay carries
  // only as a reason code.
  const { t: tFeed } = useTranslation("game/battle-messages");
  /**
   * Whether this death went our way, which colours the WHOLE line.
   *
   * Not the sides of the two names: the event has one meaning and it is read
   * at a glance. A dead enemy is green whoever killed them, a dead ally is red
   * even when an ally did it, because a team kill is not good news. Reading
   * green or red down the column is then reading how the battle went.
   */
  const good = (death: Death) => {
    const victim = byId.get(death.victim);
    if (!victim) return null;
    return victim.team !== ourTeam;
  };
  /** The player, with their vehicle as the detail beside it, or null. */
  const who = (id: number | null) => {
    const found = id === null ? undefined : byId.get(id);
    if (!found) return null;
    return {
      name: found.player?.nickname ?? found.tank?.shortName ?? null,
      tank: found.player?.nickname ? (found.tank?.shortName ?? null) : null,
    };
  };

  /**
   * The names the client gives a vehicle's bench, best first.
   *
   * More than one, because `SELF` is not a side: it is "this is the reader",
   * and the game only words it specially where it has bothered to. There is a
   * `FROM_RAMMING_ALLY_SELF` ("Vehicle was destroyed by ally X") but no
   * `FROM_SHOT_ALLY_SELF`, where the reader is simply an ally like any other.
   * Rather than carry a list of which cause has which variant, the richer name
   * is tried and the plain one catches it.
   */
  const sides = (id: number | null) => {
    const found = id === null ? undefined : byId.get(id);
    if (!found) return [];
    const bench = found.team === ourTeam ? "ALLY" : "ENEMY";
    const mine =
      found.account !== undefined && found.account === highlightAccount;
    return mine ? ["SELF", bench] : [bench];
  };

  /**
   * The sentence the battle feed would have printed for this death.
   *
   * Every spelling the client might have for this pair, in order, and the first
   * that exists wins. `SELF` leads because it is the most specific, and the
   * plain bench follows because most causes have nothing else.
   *
   * With no attacker, two different things are tried and they are not the same
   * claim: `UNKNOWN` is "somebody did this and we did not see who", which the
   * game words as "Enemy (Unknown) destroyed X", and the suicide form is
   * "nobody did this". A recording that lost sight of the shot wants the first.
   */
  const sentence = (death: Death) => {
    const cause = (DEATH_MESSAGE_CODE[death.reason ?? 0] ?? "DEATH_FROM_SHOT")
      .replace("DEATH_", "");
    const by = death.by === null || death.by === death.victim ? null : death.by;
    const victims = sides(death.victim);
    const keys: string[] = [];
    for (const target of victims) {
      if (by) for (const attacker of sides(by)) keys.push(`${cause}_${attacker}_${target}`);
      else keys.push(`${cause}_UNKNOWN_${target}`, `${cause}_${target}_SUICIDE`);
    }
    for (const key of keys) {
      const said = tFeed(key);
      if (said && said !== key) return { text: said, by };
    }
    // Nothing matched, so the row still names who died: a blank line is the one
    // outcome a reader cannot interpret.
    return { text: null, by };
  };

  return (
    <div
      style={{ "--timeline-height": `${height}px` } as CSSProperties}
      className="border-border bg-background/40 flex max-h-40 w-full max-w-lg min-w-0 flex-col overflow-hidden rounded-lg border text-xs lg:max-h-[var(--timeline-height)] lg:min-w-0 lg:flex-1 lg:basis-0 lg:max-w-none"
    >
      <Roster
        side={roster}
        diedAt={diedAt}
        highlightAccount={highlightAccount}
        ally={false}
        at={at}
        ticks={ticks}
      />
      <div
        ref={box}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-2"
      >
      <div
        className={cn(
          "flex-1",
          done.length === 0 && "flex items-center justify-center text-center",
        )}
      >
        {done.length === 0 ? (
          <p className="text-muted-foreground/60 max-w-[22ch] leading-relaxed text-pretty">
            {deaths.length === 0 ? t("replay.deaths-none") : t("replay.deaths-yet")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {done.map((death, index) => {
              const victim = who(death.victim);
              const said = sentence(death);
              const verdict = good(death);
              return (
                <li
                  key={`${death.at}-${index}`}
                  className={cn(
                    "leading-relaxed [overflow-wrap:anywhere]",
                    verdict === null
                      ? "text-muted-foreground"
                      : verdict
                        ? "text-emerald-400"
                        : "text-red-400",
                  )}
                >
                  <span className="text-muted-foreground/45 mr-1.5 text-[10px] tabular-nums">
                    {clock(death.at / ticks)}
                  </span>
                  {/* The feed's own sentence, in the one colour the whole line
                      takes. Never empty: a row that resolved to no message
                      still says who died, which is the part a reader came
                      for. */}
                  {said.text
                    ? named(said.text, [
                        { at: "attacker", who: who(said.by) },
                        { at: "target", who: victim },
                      ])
                    : named("%(target)s", [{ at: "target", who: victim }])}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}

/**
 * A command's text with the game's own placeholders filled in.
 *
 * The client stores `Requesting fire at %(target)s!` and fills it at the moment
 * it draws the line, from the arguments in the same packet. Doing the same here
 * is the difference between a readable callout and the template that produced
 * it. A typed line has no placeholders and passes straight through.
 *
 * Anything that cannot be filled keeps its placeholder rather than being
 * guessed at or blanked: a sentence with a visible gap is a bug report, a
 * sentence quietly missing a word is a lie.
 */
function fill(
  line: ChatLine,
  byId: Map<number, Participant>,
  bounds: Bounds | null,
  tGame: TranslateFunction,
): string {
  if (!line.command) return line.text;
  // The client's own sentence in the reader's language, filed under the same
  // `msgText` key the command table carries. The English that travelled with
  // the response is the fallback, for a language that namespace has no entry
  // for: `tGame` answers with the key itself when it holds nothing.
  const said = tGame(line.command);
  const text = said && said !== line.command ? said : line.text;
  if (!text.includes("%(")) return text;
  const target = line.target == null ? undefined : byId.get(line.target);
  const named =
    target?.player?.nickname ?? target?.tank?.shortName ?? null;
  // Six names appear across the forty-one messages, and most of them are the
  // packet's OWN field names: the client formats with `**self._protoData`, so
  // the dict's keys land in the sentence as they are. Only the ones that pass
  // through `_handleHasTarget` get a computed `target`, and only one asks for a
  // minimap cell.
  return text.replace(/%\((\w+)\)[sdf]/g, (whole, key: string) => {
    switch (key) {
      case "target":
        return named ?? whole;
      // Both spellings of the same thing: the reload callouts say `floatArg1`
      // because that is the field, the artillery one says `reloadTime` because
      // its handler renames it on the way in.
      case "reloadTime":
      case "floatArg1":
        return line.reloadTime != null ? String(line.reloadTime) : whole;
      case "strArg1":
        return line.label ?? whole;
      // The objective commands print the raw number as the objective's label.
      case "int32Arg1":
        return line.target != null ? String(line.target) : whole;
      case "cellName":
      case "gridId":
        return cellOf(line.where, bounds) ?? whole;
      default:
        return whole;
    }
  });
}

/**
 * The minimap cell a place falls in, `C7`, or null without an extent.
 *
 * The game rules its minimap into ten by ten: columns A to J from the left,
 * rows 1 to 10 from the TOP, which is why the row is counted down from the
 * upper edge rather than up from the lower one. Clamped, because a ping on the
 * very border would otherwise land on an eleventh column that does not exist.
 */
function cellOf(
  where: { x: number; z: number } | null | undefined,
  bounds: Bounds | null,
): string | null {
  if (!where || !bounds) return null;
  const width = bounds.upperRight.x - bounds.bottomLeft.x;
  const height = bounds.upperRight.z - bounds.bottomLeft.z;
  if (width <= 0 || height <= 0) return null;
  const clamp = (value: number) => Math.min(9, Math.max(0, Math.floor(value * 10)));
  const column = clamp((where.x - bounds.bottomLeft.x) / width);
  const row = clamp((bounds.upperRight.z - where.z) / height);
  return `${String.fromCharCode(65 + column)}${row + 1}`;
}

/**
 * The battle chat, revealed as the clock reaches each line.
 *
 * **Everything here is a player's own typing and is treated as such.** The game
 * records the line as markup and the parser takes that apart, so what arrives
 * is plain text; it is put in the tree as a string, which React escapes, and
 * never as HTML. There is no path from a replay to markup on this page.
 *
 * Most battles have nothing to show: of six real recordings, four carried no
 * line at all. So the column has to be worth its place when empty, which is why
 * it says so rather than drawing an empty box.
 */
function ChatColumn({
  lines,
  byId,
  bounds,
  ourTeam,
  roster,
  diedAt,
  highlightAccount,
  at,
  ticks,
  height,
  t,
}: {
  lines: ChatLine[];
  byId: Map<number, Participant>;
  /** The arena's extent, which turns a ping's metres into a minimap cell. */
  bounds: Bounds | null;
  ourTeam: number;
  /** This side's players, listed above the column as the game lists them. */
  roster: Participant[];
  /** When each vehicle died, for greying the roster as the clock passes. */
  diedAt: Map<number, number>;
  /** The page's own player, picked out in the roster. */
  highlightAccount?: number;
  at: number;
  ticks: number;
  /** The instrument's measured height, which this column matches exactly. */
  height: number;
  t: TranslateFunction;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  // The game's own words for the quick commands, the same way the maps and the
  // equipment are named: looked up, never translated here.
  const { t: tGame } = useTranslation("game/chat-commands");
  const now = at * ticks;
  const said = lines.filter((line) => line.at <= now);

  // Follow the newest, the way a chat does. Keyed on the count rather than on
  // the clock, so scrubbing backwards does not fight the scroll on every
  // frame: the list only moves when a line actually joins it.
  useEffect(() => {
    const node = box.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [said.length]);

  return (
    // Same frame and same height as the instrument beside it, so the two read
    // as one object rather than a panel and a box that happen to be adjacent.
    // No heading: a column of timestamped lines beside a replay is a chat, and
    // a label over it would only be a label.
    // The same height as the instrument beside it, and a REAL height rather
    // than a stretch. `items-stretch` only sets a floor: a long conversation
    // still pushed the row taller and the panel grew instead of scrolling,
    // because `overflow-y-auto` had no height to respect. So the instrument is
    // measured and this matches it, which is also the only way the two bottom
    // edges actually line up: adding the map's width to a guess at the chrome
    // above and below it was twenty pixels out.
    //
    // Through a custom property because the cap only applies from `lg`, where
    // the two sit side by side. Stacked below that, the panel keeps its own
    // short height and the map above it is already the tall thing.
    // The roster is a fixed head and the conversation scrolls under it, so a
    // busy battle never pushes the team list out of sight.
    <div
      style={{ "--chat-height": `${height}px` } as CSSProperties}
      className="border-border bg-background/40 flex max-h-40 w-full max-w-lg min-w-0 flex-col overflow-hidden rounded-lg border text-xs lg:max-h-[var(--chat-height)] lg:min-w-0 lg:flex-1 lg:basis-0 lg:max-w-none"
    >
      <Roster
        side={roster}
        diedAt={diedAt}
        highlightAccount={highlightAccount}
        ally
        at={at}
        ticks={ticks}
      />
      <div
        ref={box}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-2"
      >
      <div
        className={cn(
          "flex-1",
          // Nothing to read: the line sits in the middle of the panel rather
          // than clinging to its top edge, where it would read as the first of
          // a list that never came.
          said.length === 0 && "flex items-center justify-center text-center",
        )}
      >
        {said.length === 0 ? (
          <p className="text-muted-foreground/60 max-w-[22ch] leading-relaxed text-pretty">
            {lines.length === 0 ? t("replay.chat-none") : t("replay.chat-yet")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {said.map((line, index) => {
              // A command names its sender by vehicle id, so it is resolved
              // against the battle's own list and shown only when it matches:
              // the field is not that for every command, and half a name is
              // worse than none.
              const who = line.sender != null ? byId.get(line.sender) : undefined;
              const name = line.command
                ? (who?.player?.nickname ?? who?.tank?.shortName ?? null)
                : line.from;
              const ally = line.command ? who?.team === ourTeam : line.ally;
              return (
                // `overflow-wrap: anywhere` rather than `break-words`, which
                // broke "Attention" across two lines mid-word, or `break-all`,
                // which breaks every word mid-word. This one wraps at spaces
                // like prose and only cuts into a word when the word genuinely
                // cannot fit: a player typed sixty unbroken characters and the
                // column grew a horizontal scrollbar.
                // The WHOLE line takes the side's colour, which is what the
                // game does: a chat line is read first as "one of mine" or
                // "one of theirs", and colouring only the name left the part
                // that matters in neutral grey. The vehicle and the colon stay
                // dimmed against it so the sentence still has a shape.
                <li
                  key={`${line.at}-${index}`}
                  className={cn(
                    "leading-relaxed [overflow-wrap:anywhere]",
                    ally ? "text-emerald-400" : "text-red-400",
                  )}
                >
                  <span className="text-muted-foreground/45 mr-1.5 text-[10px] tabular-nums">
                    {clock(line.at / ticks)}
                  </span>
                  {name ? (
                    <>
                      <span className="font-medium">{name}</span>
                      <span className="opacity-60">
                        {line.vehicle ? ` (${line.vehicle})` : ""}
                      </span>
                      <span className="mx-1 opacity-50">:</span>
                    </>
                  ) : null}
                  {/* A quick command reads exactly like a typed line, because
                      that is how the game shows it. Marking it apart was an
                      invention of this page, and an invention a reader stops on
                      to wonder about is one that costs more than it carries. */}
                  <span>{fill(line, byId, bounds, tGame)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}

/**
 * The game's own team hit-point strip, above the map.
 *
 * Two bars meeting in the middle, each growing away from the centre, with the
 * team's remaining hit points on the inside end and one glyph per vehicle
 * underneath, dimmed as that vehicle dies. The reader already knows this shape
 * from the battle HUD, which is the whole point: the question "how is this
 * going" is answered by a shape rather than by reading fourteen rings.
 *
 * **It shows what the recording client knew, and that is not always the
 * truth.** Hit points are only heard about for a vehicle this client could
 * see, so one that took damage out of sight keeps the last figure it was told.
 * Death is the exception and is taken from the battle's own results instead,
 * which is why a wreck reads as zero even when nobody watched it burn: that is
 * the single biggest error the bar would otherwise carry.
 */
/** `deathReason` when a vehicle was still alive at the end. */
const SURVIVED = -1;

function TeamStrip({
  tracks,
  byId,
  ourTeam,
  highlightAccount,
  at,
  startsAt,
  ticks,
  t,
}: {
  tracks: Track[];
  byId: Map<number, Participant>;
  ourTeam: number;
  highlightAccount?: number;
  at: number;
  /** The tick the countdown ends, needed to date a death with no track. */
  startsAt: number;
  ticks: number;
  t: TranslateFunction;
}) {
  const sides = useMemo(() => {
    const empty = () => ({ hp: 0, max: 0, alive: 0, members: [] as Member[] });
    const ours = empty();
    const theirs = empty();
    // Over the PARTICIPANTS, not over the tracks, and that distinction is the
    // whole of this block. A track exists only for a vehicle the recording
    // client saw; an enemy nobody ever spotted has none. Walking the tracks
    // therefore left that tank out of its team entirely -- the bar read
    // "15 vs 14" on a full battle, and the side's hit points were short by one
    // tank's worth. Who was in a battle is a fact of the battle, which the
    // results state for all thirty; only WHERE they were, and their health
    // minute by minute, depend on having been seen.
    const seen = new Map(tracks.map((track) => [track.id, track]));
    for (const who of byId.values()) {
      const track = seen.get(who.id);
      // The results' own figure first: it is there for every vehicle, while a
      // track's is zero for a world entity that is not a tank at all.
      const max = who.own.maxHealth || track?.maxHealth || 0;
      if (!max) continue;
      const side = who.team === ourTeam ? ours : theirs;
      // A seen vehicle's death is already dated in the recording's clock by
      // the route, which merges the battle's timing with the packet's. For an
      // unseen one the results still say how long they lived, in the battle's
      // own clock, which the countdown offset turns into this one.
      const diedAt =
        track?.diedAt ??
        (who.own.deathReason !== undefined && who.own.deathReason !== SURVIVED
          ? Math.round((who.own.lifeTime ?? 0) * ticks) + startsAt
          : null);
      const dead = diedAt !== null && at * ticks >= diedAt;
      // Full health until told otherwise: a vehicle nobody watched is not a
      // vehicle at zero, and counting it so was half of the missing tank.
      const hp = dead ? 0 : track ? hpAt(track, at, ticks) : max;
      side.hp += hp;
      side.max += max;
      if (!dead) side.alive += 1;
      side.members.push({
        id: who.id,
        dead,
        type: who.tank?.type ?? null,
        name: who.tank?.shortName ?? null,
        mine: who.account !== undefined && who.account === highlightAccount,
      });
    }
    // `FragCorrelationSortKey`, which is this bar's own and nothing else's
    // (`battle_control/arena_info/vos_collections.py:83`): the living before
    // the dead FIRST, then the class. No tier anywhere, and the alive test
    // leading is what makes the wrecks migrate to the far end as they fall,
    // which is most of what the row says at a glance.
    //
    // Sorted every frame rather than once, because `dead` is exactly what
    // moves as the clock does, over fourteen entries.
    for (const side of [ours, theirs]) {
      side.members.sort(
        (a, b) =>
          Number(a.dead) - Number(b.dead) ||
          classRank(a.type) - classRank(b.type) ||
          (a.name ?? "").localeCompare(b.name ?? ""),
      );
    }
    // Mirrored about the centre, with the heavies meeting IN the middle and the
    // artillery at the two outer ends. So it is our row that is reversed, not
    // theirs: ours is drawn right-justified against the centre, so reversing it
    // puts the first of the order nearest the middle, where the enemy's first
    // already sits.
    ours.members.reverse();
    return { ours, theirs };
  }, [tracks, byId, ourTeam, highlightAccount, at, startsAt, ticks]);

  if (!sides.ours.max && !sides.theirs.max) return null;

  return (
    <div className="border-border/50 flex items-stretch gap-3 border-b px-3 py-2 text-xs">
      <Side side={sides.ours} tone="ally" align="right" />
      {/* How many are still standing, not the score: the recording carries no
          score, and a figure we cannot know would be worse than none. Set at
          the size of a scoreline because that is the shape a reader expects in
          the middle of a bar like this, and it is the one number here that
          answers "who is winning" without arithmetic. */}
      <Hint content={t("replay.still-standing")}>
        <div className="flex shrink-0 items-center font-semibold tabular-nums">
          <span className="text-emerald-400 text-sm">{sides.ours.alive}</span>
          <span className="text-muted-foreground/50 mx-1.5 text-[10px]">vs</span>
          <span className="text-red-400 text-sm">{sides.theirs.alive}</span>
        </div>
      </Hint>
      <Side side={sides.theirs} tone="enemy" align="left" />
    </div>
  );
}

/**
 * The order THIS bar uses, which is not the order a vehicle list uses.
 *
 * The game has two tables and they disagree. `VEHICLE_TYPES_ORDER` (light,
 * medium, heavy, tank destroyer, artillery) is for lists of vehicles, a crew
 * filter or a garage carousel. The battle bar reads
 * `VEHICLE_BATTLE_TYPES_ORDER` instead, `gui/shared/gui_items/Vehicle.py:110`:
 *
 *     heavy, medium, tank destroyer, light, artillery
 *
 * Taking the first was this file's mistake. Both are in the sources, both are
 * named plausibly, and only one is this widget's.
 */
const CLASS_ORDER = ["heavyTank", "mediumTank", "AT-SPG", "lightTank", "SPG"];

function classRank(type: string | null): number {
  const at = type ? CLASS_ORDER.indexOf(type) : -1;
  // Anything the catalogue does not name sorts last rather than first, so one
  // unknown vehicle cannot head a team.
  return at === -1 ? CLASS_ORDER.length : at;
}

type Member = {
  id: number;
  dead: boolean;
  type: string | null;
  name: string | null;
  mine: boolean;
};

type SideState = { hp: number; max: number; alive: number; members: Member[] };

/** One team's half of the strip: the bar, its figure, and its vehicles. */
function Side({
  side,
  tone,
  align,
}: {
  side: SideState;
  tone: "ally" | "enemy";
  align: "left" | "right";
}) {
  const share = side.max ? side.hp / side.max : 0;
  const ally = tone === "ally";
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      {/* The fill grows from the centre outwards, which is what makes the two
          bars read as one gauge rather than two charts side by side. A hair
          taller than a hairline so it carries its colour at a glance, and no
          ring: inside a framed panel a second border is noise. */}
      <div className="bg-foreground/10 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-150",
            ally ? "bg-emerald-400" : "bg-red-400",
            align === "right" ? "ml-auto" : "mr-auto",
          )}
          style={{ width: `${Math.round(share * 1000) / 10}%` }}
        />
      </div>
      <div
        className={cn(
          "flex items-center gap-1.5",
          align === "right" ? "justify-end" : "justify-start",
        )}
      >
        {/* The hit points are the headline of this half, so they are set like
            one. The glyph row beside them is a census, not a figure, and stays
            quiet. */}
        <span
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            ally ? "text-emerald-400" : "text-red-400",
            align === "right" ? "order-last" : "order-first",
          )}
        >
          {Math.round(side.hp).toLocaleString()}
        </span>
        {/* One glyph a vehicle, in the order the results list them, which is
            the game's own order. A dead one keeps its side's colour at the
            same strength the map uses, so the two readings agree. */}
        <span className="flex min-w-0 flex-wrap items-center gap-1">
          {side.members.map((member) => {
            // Grey once it is dead, which is what the game does here and the
            // opposite of what the map does: on the map the side's colour is
            // the only thing left worth reading off a wreck, while in this row
            // the side is already said by which half of the strip it sits in,
            // so the colour is free to say "gone" instead.
            const tone = member.dead
              ? "text-muted-foreground/40"
              : member.mine
                ? "text-amber-300"
                : ally
                  ? "text-emerald-400"
                  : "text-red-400";
            return (
              <Hint key={member.id} content={member.name}>
                <span>
                  {member.type ? (
                    // The colour goes ON the icon. The component sets one of its
                    // own inside, so a parent's `text-…` never reaches the glyph
                    // and every vehicle came out the same pale grey: the same
                    // trap the map's markers carry a comment about, walked into
                    // again here.
                    <VehicleTypeIcon
                      type={member.type}
                      size={11}
                      className={tone}
                    />
                  ) : (
                    <span
                      className={cn("block size-[7px] rounded-full bg-current", tone)}
                    />
                  )}
                </span>
              </Hint>
            );
          })}
        </span>
      </div>
    </div>
  );
}

function hpAt(track: Track, at: number, ticks: number): number {
  const now = at * ticks;
  let hp = track.maxHealth;
  for (const [when, value] of track.health) {
    if (when > now) break;
    hp = value;
  }
  // Clamped at zero: the shot that kills reports a NEGATIVE health, which is
  // the overkill, and a team total is not owed a debt.
  return Math.max(0, Math.min(track.maxHealth, hp));
}

function healthAt(track: Track, at: number, ticks: number): number | null {
  if (!track.maxHealth) return null;
  return hpAt(track, at, ticks) / track.maxHealth;
}

/** Where a vehicle is, and whether anyone can currently see it there. */
type Seen = { x: number; z: number; spotted: boolean };

function pointAt(
  points: [number, number, number][],
  at: number,
  ticks: number,
  startsAt: number,
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
  // During the countdown every vehicle is on its spawn and perfectly still,
  // and a position is only written down when it changes, so the gap test would
  // call the whole field unspotted and draw thirty dots. Nobody is hidden
  // before the battle starts.
  const counting = now < startsAt;
  // Nothing after it: the recording holds no more of this vehicle, so this is
  // where it was last seen and not where it is.
  if (!after) return { x: before[1], z: before[2], spotted: counting };

  const span = after[0] - before[0];
  const spotted = counting || (span > 0 && span <= SPOT_GAP_S * ticks);
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
