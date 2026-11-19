"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { FilmSlateIcon } from "@phosphor-icons/react";
import type { TranslateFunction } from "@onruntime/translations";
import type { Region } from "@unicum.gg/wargaming";
import { minimapUrl } from "@unicum.gg/shared";
import { MinimapImage } from "@/components/maps/minimap-image";
import { unicum } from "@/services/sdk";
import { Overlay } from "@/components/maps/detail/minimap-overlay";
import type { MapOverlay, Participant } from "./battle-types";
import { ReplaySkeleton } from "./replay-skeleton";
import { ShotLayer } from "./replay-shots";
import { FocusLayer } from "./replay-rings";
import { PingLayer } from "./replay-pings";
import { VehicleLayer } from "./replay-vehicles";
import { Transport } from "./replay-transport";
import { FocusPanel } from "./replay-focus";
import { DamageLog } from "./replay-log";
import { RosterContext } from "./replay-roster";
import { Timeline } from "./replay-timeline";
import { ChatColumn } from "./replay-chat";
import { TeamStrip } from "./replay-strip";
import type { Bounds, Motion } from "./replay-types";
import { SURVIVED } from "./replay-math";

/** How fast the drawing advances by default, in battle seconds per second. */
const DEFAULT_SPEED = 4;

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
  recorder,
  arenaId,
  hasReplay,
  mapImage,
  bounds,
  overlay,
  participants,
  highlightAccount: initialFocus,
  t,
}: {
  region: Region;
  battleId: string;
  /** Whose recording to draw, when the battle has several. */
  recorder?: number;
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
  // Read through a ref by the frame loop, so changing it does not restart the
  // loop (and lose the frame in progress).
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  // Whose battle this is read as: the page's player to begin with, and anybody
  // else a reader picks in a roster or on the map. Everything relative follows
  // it: which side is green, whose name is yellow, which roster sits left.
  const [highlightAccount, setFocus] = useState(initialFocus);
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
  const request = () => unicum.region(region).battles(battleId).replay(recorder);
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
      const delta = (elapsed / 1000) * speedRef.current;
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
  //
  // The recording only dates the deaths its client was told about, so a tank
  // destroyed out of sight kept its row lit and full to the end. The results
  // say how long every vehicle lived, in the battle's clock, which the
  // countdown offset turns into this one, as the strip above the map does.
  const diedAt = useMemo(() => {
    const dated = new Map(
      (motion?.deaths ?? [])
        .filter((death) => death.at !== null)
        .map((death) => [death.victim, death.at as number]),
    );
    if (!motion) return dated;
    const ticks = motion.ticksPerSecond || 10;
    for (const who of participants) {
      if (dated.has(who.id)) continue;
      const reason = who.own.deathReason;
      if (reason === undefined || reason === SURVIVED) continue;
      dated.set(who.id, Math.round((who.own.lifeTime ?? 0) * ticks) + (motion.startsAt ?? 0));
    }
    return dated;
  }, [motion, participants]);
  // Who killed whom, and when on the recording. The killer is the battle
  // results' own, which name it for every death, the recording's only where
  // the results are silent: the recording names it only for a shot it saw.
  const frags = useMemo(() => {
    const killerOf = new Map(participants.map((p) => [p.id, p.own.killer]));
    const seenBy = new Map((motion?.deaths ?? []).map((death) => [death.victim, death.by]));
    // Over every dated death, the unseen ones included, so a kill made out of
    // the recorder's sight still counts on its author's row.
    return [...diedAt].flatMap(([victim, at]) => {
      const by = killerOf.get(victim) || seenBy.get(victim);
      return by && by !== victim ? [{ at, by }] : [];
    });
  }, [motion, participants, diedAt]);
  const tracksById = useMemo(
    () => new Map((motion?.tracks ?? []).map((track) => [track.id, track])),
    [motion],
  );

  if (missing) return <Notice>{t("replay.none")}</Notice>;
  if (isLoading) {
    return (
      <ReplaySkeleton
        arenaId={arenaId}
        mapImage={mapImage ?? null}
        rows={Math.max(
          ...[...new Set(participants.map((p) => p.team))].map(
            (team) => participants.filter((p) => p.team === team).length,
          ),
          1,
        )}
      />
    );
  }
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
  // At the last frame, where the clock stops on its own.
  const ended = at >= motion.duration - 0.25;
  // Defaulted, because a browser may still hold a response from before this
  // field existed, whose clocks were in tenths. Reading it as `undefined`
  // turns every comparison into NaN and the map draws no vehicles at all,
  // which is exactly what happened.
  const ticks = motion?.ticksPerSecond || 10;
  // The name rides at the glyph's shoulder, so it follows the same scale. Not
  // below 7px: under that it is a smudge rather than a word, and a smudge on
  // every one of thirty vehicles is worse than no label at all.
  const labelPx = Math.max(7, Math.round(mapWidth * 0.019));
  // Whose sight the recording is: the vehicle the loadouts name, else the
  // recorder asked for, else the page's own player.
  const recorderVehicle =
    motion.loadouts?.[0]?.vehicle ??
    participants.find(
      (p) => p.account !== undefined && p.account === (recorder ?? initialFocus),
    )?.id ??
    null;
  const recorderTeam =
    recorderVehicle === null ? null : (byId.get(recorderVehicle)?.team ?? null);
  const ourTeam =
    participants.find((p) => p.account !== undefined && p.account === highlightAccount)
      ?.team ?? 1;

  return (
    <RosterContext.Provider
      value={{
        region,
        frags,
        tracks: tracksById,
        focus: setFocus,
        startsAt: motion.startsAt ?? 0,
        recorderTeam,
        recorderVehicle,
        observed: motion.observed ?? [],
      }}
    >
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
        log={(() => {
          const focused = participants.find(
            (p) => p.account !== undefined && p.account === highlightAccount,
          );
          return focused ? (
            <DamageLog
              focused={focused}
              recorder={focused.id === recorderVehicle}
              motion={motion}
              byId={byId}
              at={at}
              ticks={ticks}
              t={t}
            />
          ) : undefined;
        })()}
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
        {/* The game's rings around the vehicle being followed, under
            everything that moves: they describe the ground, not a tank. */}
        {bounds ? (
          <FocusLayer
            participants={participants}
            highlightAccount={highlightAccount}
            tracksById={tracksById}
            motion={motion}
            at={at}
            ticks={ticks}
            bounds={bounds}
            recorderTeam={recorderTeam}
          />
        ) : null}
        {/* The shells, under the vehicles: a trace from the muzzle to where
            it landed, in the colour of the side that fired. */}
        {bounds && motion.shots?.length ? (
          <ShotLayer
            shots={motion.shots}
            at={at}
            ticks={ticks}
            bounds={bounds}
            colourOf={(by) => {
              const who = byId.get(by);
              if (who?.account !== undefined && who.account === highlightAccount) {
                return "text-amber-300";
              }
              return who?.team === ourTeam ? "text-emerald-400" : "text-red-400";
            }}
          />
        ) : null}
        {bounds ? (
          <PingLayer
            chat={motion.chat ?? []}
            byId={byId}
            ourTeam={ourTeam}
            at={at}
            ticks={ticks}
            bounds={bounds}
            markerPx={markerPx}
          />
        ) : null}
        {bounds ? (
          <VehicleLayer
            tracks={motion.tracks}
            byId={byId}
            ourTeam={ourTeam}
            highlightAccount={highlightAccount}
            recorderTeam={recorderTeam}
            at={at}
            ticks={ticks}
            startsAt={motion.startsAt ?? 0}
            bounds={bounds}
            markerPx={markerPx}
            labelPx={labelPx}
            mapPx={mapWidth || 512}
            setFocus={setFocus}
          />
        ) : null}
      </div>

      <Transport
        at={at}
        duration={motion.duration}
        playing={playing}
        ended={ended}
        setAt={setAt}
        setPlaying={setPlaying}
        speed={speed}
        setSpeed={setSpeed}
        t={t}
      />
      {(() => {
        const focused = participants.find(
          (p) => p.account !== undefined && p.account === highlightAccount,
        );
        return focused ? (
          <FocusPanel
            focused={focused}
            track={tracksById.get(focused.id)}
            motion={motion}
            recorder={focused.id === recorderVehicle}
            at={at}
            ticks={ticks}
            region={region}
            colour="text-amber-300"
            t={t}
          />
        ) : null;
      })()}
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
    </RosterContext.Provider>
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

