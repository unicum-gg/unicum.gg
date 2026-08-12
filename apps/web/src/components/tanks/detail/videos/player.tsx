"use client";

import {
  createContext,
  useSyncExternalStore,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { PlusIcon, XIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { RefObject } from "react";
import type { MediaPlayerInstance } from "@vidstack/react";
import { MAP_GAME_MODE_LABEL, youtubeWatchUrl } from "@unicum.gg/shared";
import useSWR from "swr";
import type { Region } from "@unicum.gg/wargaming";
import { useSession } from "@/lib/auth-client";
import { unicum } from "@/services/sdk";
import type { TankVideoCardData } from "./card";
import { ActiveBattleTracker } from "./active-battle-tracker";
import {
  readBattleParam,
  subscribeToBattleParam,
  writeBattleParam,
} from "./battle-param";

/** The player library is only worth downloading once someone plays something,
 * and it drives an embed, so there is nothing for the server to render. */
const PlyrPlayer = dynamic(() => import("./plyr-player"), { ssr: false });

/** SWR key for the reader's own queued battles. Exported so the form can drop
 * it after a submission: the row it just created belongs in the list right
 * away, not on the next reload. */
export function ownVideosKey(region: Region, slug: string): string {
  return `videos:mine:${region}:${slug}`;
}

/** The hero the player takes over, so a card can scroll it back into view when
 * the click happened further down the page. */
const TANK_HERO_ID = "tank-hero";

/** A button floated over the video, readable on any frame. */
const CHROME_BUTTON =
  "flex cursor-pointer items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-sm text-white/80 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white";

/** A moment handed from the hero to the suggestion form: the video being
 * watched, at the second the viewer stopped on. */
export type TankVideoSuggestion = { url: string; startSeconds: number };

type TankVideoPlayer = {
  /** Every battle this page knows of: the published ones it was given, plus the
   * reader's own that are still queued. */
  videos: TankVideoCardData[];
  current: TankVideoCardData | null;
  /** The player instance, for a caller that reads the playhead on demand. */
  playerRef: RefObject<MediaPlayerInstance | null>;
  /** The battle the playhead is inside, published as it changes so the lists
   * can light the row being watched rather than the one last clicked. */
  activeId: number | null;
  /** Every battle marked in the video being played, the one playing included,
   * so the seek bar can show them all. */
  siblings: TankVideoCardData[];
  play: (video: TankVideoCardData) => void;
  stop: () => void;
  /** Set while the form should open on a moment picked in the hero, and read by
   * the form as its starting values. */
  setActiveId: (id: number | null) => void;
  suggestion: TankVideoSuggestion | null;
  suggest: (startSeconds: number) => void;
};

const PlayerContext = createContext<TankVideoPlayer | null>(null);

/** Null outside a provider, which is what lets the card stay usable on its own
 * (it falls back to playing in place). */
export function useTankVideoPlayer(): TankVideoPlayer | null {
  return useContext(PlayerContext);
}

/**
 * Holds which battle the page is playing.
 *
 * The state lives above both the hero and the lists because the two are
 * siblings in a server-rendered tree: the cards are what you click, the hero is
 * where it plays, and neither can own the other.
 */
export function TankVideoPlayerProvider({
  region,
  slug,
  videos: published,
  children,
}: {
  region: Region;
  slug: string;
  /** The page's published battles, so a `?battle=` link can be opened on
   * arrival. */
  videos: TankVideoCardData[];
  children: React.ReactNode;
}) {
  // The reader's own queued battles, fetched here rather than in the list.
  // Marked, so the list can grey them out, and known to the player, so they
  // show among the seek-bar markers: someone waiting on a review wants to see
  // where in the video their suggestion sits.
  const { data: session } = useSession();
  const { data: mine } = useSWR(
    session?.user ? ownVideosKey(region, slug) : null,
    () =>
      unicum
        .region(region)
        .tanks(slug)
        .videosMine()
        .then((r) => r.videos as unknown as TankVideoCardData[]),
  );
  const videos = useMemo(
    () =>
      mine?.length
        ? [...published, ...mine.map((v) => ({ ...v, pending: true }))]
        : published,
    [published, mine],
  );
  /**
   * Which battle is playing, read from the URL rather than held beside it.
   *
   * The param has to exist anyway, so that a battle can be linked to, and two
   * copies of the same truth drift: opening a `?battle=` link would have meant
   * an effect pushing it into state, which is the pattern the compiler rejects
   * and for good reason. Here the link works by construction, and Back leaves
   * the video the way it found it.
   *
   * The server snapshot is null, so the prerendered HTML has no player and
   * hydration matches; React re-reads the URL right after and opens it.
   */
  const currentId = useSyncExternalStore(
    subscribeToBattleParam,
    readBattleParam,
    () => null,
  );
  const current = useMemo(
    // Published only: a queued battle is not live, so a link cannot open one.
    () => videos.find((v) => v.id === currentId && !v.pending) ?? null,
    [videos, currentId],
  );
  // Every battle marked in the video being played, for the seek-bar markers and
  // for the row the lists light up. Sorted by timestamp, the order they happen
  // in: the endpoint returns newest-approved first, and both readers walk the
  // list expecting the playhead to move through it.
  const siblings = useMemo(
    () =>
      current
        ? videos
            .filter((v) => v.videoId === current.videoId)
            .sort((a, b) => a.startSeconds - b.startSeconds)
        : [],
    [videos, current],
  );
  // Held here rather than in the hero, so the cards can read the playhead too.
  const playerRef = useRef<MediaPlayerInstance>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  const play = useCallback((video: TankVideoCardData) => {
    writeBattleParam(video.id);
    // The videos tab sits well below the fold, so playing in the hero would
    // otherwise start a video off-screen.
    const hero = document.getElementById(TANK_HERO_ID);
    if (!hero) return;
    // Not `scrollIntoView`, which aligns the hero with the viewport top and so
    // tucks its first rows under the sticky header. Measured rather than a
    // constant, so a header of a different height stays right.
    const header = document.querySelector("header");
    const offset =
      header && getComputedStyle(header).position === "sticky"
        ? header.getBoundingClientRect().height
        : 0;
    const top = hero.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, []);

  const stop = useCallback(() => writeBattleParam(null), []);

  const [suggestion, setSuggestion] = useState<TankVideoSuggestion | null>(null);

  /**
   * Hand the moment being watched to the suggestion form.
   *
   * A single video usually holds several battles, and without this each one
   * meant reopening the form, pasting the same link and hunting for the moment
   * again. Here the video is already open at the right second.
   *
   * The player closes with it: the form is further down the page, and leaving a
   * battle playing behind a dialog is noise.
   */
  const suggest = useCallback(
    (startSeconds: number) => {
      if (!current) return;
      setSuggestion({
        url: youtubeWatchUrl(current.videoId, startSeconds),
        startSeconds,
      });
      // Paused, not closed. It used to close, from when the button floated over
      // the video and the form was further down the page. The button now lives
      // in the player's own control bar, so tearing the video out from under
      // the cursor reads as the click having broken something, and coming back
      // meant finding the battle again. The form has its own player, hence the
      // pause: two videos playing at once is the thing to avoid, not this one
      // existing.
      playerRef.current?.pause();
    },
    [current],
  );

  const value = useMemo(
    () => ({
      videos,
      current,
      siblings,
      playerRef,
      activeId,
      setActiveId,
      play,
      stop,
      suggestion,
      suggest,
    }),
    [videos, current, siblings, activeId, play, stop, suggestion, suggest],
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

/**
 * The hero box, which owns its own shape while a battle is playing.
 *
 * The hero is wider than a video (32/15 against 16/9), so filling its width
 * would mean cropping the recording, and a battle is watched for what is on the
 * edges of the screen. It takes the video's shape instead, growing by the
 * difference. Its children stay server-rendered: they come through as
 * `children`, so this only decides the box.
 */
export function TankHero({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const player = useTankVideoPlayer();
  return (
    <div
      id={TANK_HERO_ID}
      className={cn(
        className,
        // Repeated at both breakpoints on purpose: the base classes set the
        // aspect under `sm:`, and tailwind-merge only drops a class the
        // override actually matches.
        player?.current && "aspect-video min-h-0 sm:aspect-video",
      )}
    >
      {children}
    </div>
  );
}

/**
 * The player itself, covering the hero while a battle is playing.
 *
 * Sits on black rather than stretching to the hero's wider box: a battle
 * recording is 16:9 and cropping it would cut the part of the screen the
 * suggestion is about. Nothing else is drawn over it.
 */
export function TankVideoHeroPlayer() {
  const player = useTankVideoPlayer();
  // Signed out the form renders a log-in link instead of a dialog, so the
  // shortcut would hand a moment to nothing.
  const { data: session } = useSession();
  const video = player?.current ?? null;
  const stop = player?.stop;
  const [attached, setAttached] = useState(false);
  const siblings = player?.siblings;
  const playerRef = player?.playerRef;

  // A tick per battle on the seek bar, the way a chaptered video shows its
  // parts: a recording usually holds several, and they were only listed under
  // the card, so nothing said where the next one was while watching this one.
  const markers = useMemo(
    () =>
      (siblings ?? []).map((battle) => ({
        time: battle.startSeconds,
        label: [
          battle.mapName,
          battle.mode ? MAP_GAME_MODE_LABEL[battle.mode] : null,
          battle.directionLabel,
          battle.pending ? "in review" : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    [siblings],
  );

  useEffect(() => {
    if (!video || !stop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [video, stop]);

  if (!video) return null;

  return (
    // A pixel short of the bottom, like the hero's other full-bleed layers: an
    // opaque layer flush with the edge takes most of the device row the panel's
    // bottom border falls in, and thins it out.
    <div className="absolute inset-x-0 top-0 bottom-px z-30 bg-black">
      {/* Fills the hero, which `TankHero` has already reshaped to 16:9, so the
          video is full width with nothing cropped. */}
      <PlyrPlayer
        // Keyed on the battle so picking another card remounts the player at
        // its own timestamp, instead of it keeping the first video.
        key={`${video.videoId}-${video.startSeconds}`}
        videoId={video.videoId}
        title={video.title}
        startSeconds={video.startSeconds}
        playerRef={playerRef}
        markers={markers}
        autoPlay
        onCanPlay={() => setAttached(true)}
        toolbar={
          session?.user ? (
            // Dropped into the player's own control bar rather than floated
            // over the video: it acts on the playhead, like the controls it
            // sits between. Plyr's classes give it their hover state and
            // tooltip, so it does not read as a foreign button.
            <button
              type="button"
              onClick={() =>
                player?.suggest(Math.floor(playerRef?.current?.currentTime ?? 0))
              }
              className="plyr__controls__item plyr__control"
            >
              <PlusIcon className="size-4" weight="bold" />
              <span className="plyr__tooltip">Suggest this moment</span>
            </button>
          ) : undefined
        }
      />
      {playerRef && siblings && (
        <ActiveBattleTracker
          // Keyed on the player it watches, not just on "has one appeared":
          // picking another battle remounts the player, and a subscription
          // taken on the previous instance keeps reporting its dead clock. The
          // `attached` half covers the first mount, which happens a commit late
          // because the player is imported on demand.
          key={`${attached}-${video.videoId}-${video.startSeconds}`}
          playerRef={playerRef}
          battles={siblings}
          onActive={player?.setActiveId}
        />
      )}
      {/* The only chrome over the video: the card the click came from already
          carries the title, the channel and the battle, so repeating them here
          would just be a band of text under it. */}
      <button
        type="button"
        onClick={stop}
        aria-label="Close the video"
        // Above `.vds-blocker`, the layer the player puts over the embed to
        // catch clicks. It is `z-index: 1` in this same stacking context, so an
        // unpositioned button sits under it and every click on Close was
        // reaching the player as a play/pause toggle instead.
        className={cn("absolute right-3 top-3 z-10", CHROME_BUTTON)}
      >
        <XIcon className="size-4" />
        Close
      </button>
    </div>
  );
}
