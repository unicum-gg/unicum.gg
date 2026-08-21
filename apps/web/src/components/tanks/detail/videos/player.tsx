"use client";

import {
  createContext,
  useSyncExternalStore,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import type { RefObject } from "react";
import type { MediaPlayerInstance } from "@vidstack/react";
import { youtubeWatchUrl } from "@unicum.gg/shared";
import useSWR from "swr";
import type { Region } from "@unicum.gg/wargaming";
import { useSession } from "@/lib/auth-client";
import { unicum } from "@/services/sdk";
import type { TankVideoCardData } from "./card";
import { VideoPlayerSurface } from "./surface";
import {
  readBattleParam,
  subscribeToBattleParam,
  writeBattleParam,
} from "./battle-param";

/** SWR key for the reader's own queued battles. Exported so the form can drop
 * it after a submission: the row it just created belongs in the list right
 * away, not on the next reload. */
export function ownVideosKey(region: Region): string {
  return `videos:mine:${region}`;
}

/** The hero the player takes over, so a card can scroll it back into view when
 * the click happened further down the page. */
const TANK_HERO_ID = "tank-hero";

/** A button floated over the video, readable on any frame. */
export const CHROME_BUTTON =
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
  /** Whether a suggestion form is mounted under this provider. False on a
   * surface that only plays what others filed, where the button would set a
   * moment nothing reads. */
  canSuggest: boolean;
  /** Called by a form on mount; the returned function unregisters it. This is
   * derived rather than declared per page, so a page that grows a form lights
   * the button up on its own, and one that loses it stops offering a dead
   * click. */
  registerForm: () => () => void;
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
  videos: published,
  ownTankSlug,
  ownMapSlug,
  ownClanId,
  anchorId = TANK_HERO_ID,
  children,
}: {
  region: Region;
  /** The page's published battles, so a `?battle=` link can be opened on
   * arrival. */
  videos: TankVideoCardData[];
  /**
   * Which of the reader's queued battles belong on this page. The queue is
   * fetched whole, because someone waiting on a review is waiting on all of
   * them, and each page keeps the rows it is about: a tank page its vehicle's,
   * a map page the ones fought on its ground.
   *
   * Plain fields rather than the predicate this started as: the tank page
   * mounts this from its layout, which is a server component, and a function
   * cannot cross that boundary.
   */
  ownTankSlug?: string;
  ownMapSlug?: string;
  /**
   * The same, for a clan's tab: the queued rows crediting this clan.
   *
   * An id rather than a tag, like the stored credit itself, so a rename cannot
   * strand it. Without it a clan page showed the reader their whole queue,
   * every random battle on every tank included, filed under a clan that has
   * nothing to do with them.
   */
  ownClanId?: number;
  /** The element a battle plays in, scrolled to when one opens. The tank page's
   * hero by default, since that is where this started. */
  anchorId?: string;
  children: React.ReactNode;
}) {
  // The reader's own queued battles, fetched here rather than in the list.
  // Marked, so the list can grey them out, and known to the player, so they
  // show among the seek-bar markers: someone waiting on a review wants to see
  // where in the video their suggestion sits.
  const { data: session } = useSession();
  const { data: mine } = useSWR(
    session?.user ? ownVideosKey(region) : null,
    () =>
      unicum
        .region(region)
        .videosMine()
        .then((r) => r.videos as unknown as TankVideoCardData[]),
  );
  const videos = useMemo(() => {
    const queued = (mine ?? []).filter(
      (v) =>
        (!ownTankSlug || v.tankSlug === ownTankSlug) &&
        (!ownMapSlug || v.mapSlug === ownMapSlug) &&
        // Region included: clan ids are region-scoped, and the queue is not
        // (one table, and a submission takes its region from the page it was
        // sent from), so an id alone can name two different clans.
        (!ownClanId ||
          (v.clan?.id === ownClanId && v.clan?.region === region)),
    );
    return queued.length
      ? [...published, ...queued.map((v) => ({ ...v, pending: true }))]
      : published;
  }, [published, mine, ownTankSlug, ownMapSlug, ownClanId, region]);
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
    // Queued rows included. They are only ever in this list for the person who
    // submitted them, so nobody else can open one: the row a stranger's `?battle=`
    // would name simply is not there. And the submitter has the best reason of
    // anyone to play it, which is to check the second they picked is right.
    () => videos.find((v) => v.id === currentId) ?? null,
    [videos, currentId],
  );
  // Every battle marked in the video being played, for the seek-bar markers and
  // for the row the lists light up.
  //
  // Fetched whole rather than filtered out of the page, because the page only
  // holds its own slice: a map page knows the battles fought on its ground, and
  // a competitive evening runs through a rotation, so the seek bar would mark
  // one battle out of five and say nothing about where the next map starts.
  // The page's own rows answer in the meantime, so the markers appear at once
  // and grow when the fetch lands.
  const { data: allBattles } = useSWR(
    current ? `video-battles:${region}:${current.videoId}` : null,
    () =>
      unicum
        .region(region)
        .videos(current!.videoId)
        .then((r) => r.videos as unknown as TankVideoCardData[]),
  );
  const siblings = useMemo(() => {
    if (!current) return [];
    const published =
      allBattles ?? videos.filter((v) => v.videoId === current.videoId && !v.pending);
    // The reader's own queued rows are theirs alone, so they are never in the
    // published answer: someone waiting on a review wants to see where in the
    // video their suggestion sits.
    //
    // Read from the whole queue rather than from the page's list, for the same
    // reason the published half is fetched whole: the page's list is scoped to
    // its own ground, so a battle queued on another map of the same recording
    // would be missing from the timeline it belongs to.
    const queued = (mine ?? [])
      .filter((v) => v.videoId === current.videoId)
      .map((v) => ({ ...v, pending: true }));
    return [...published, ...queued].sort(
      (a, b) => a.startSeconds - b.startSeconds,
    );
  }, [videos, current, allBattles, mine]);
  // Held here rather than in the hero, so the cards can read the playhead too.
  const playerRef = useRef<MediaPlayerInstance>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  const play = useCallback((video: TankVideoCardData) => {
    writeBattleParam(video.id);
    // The list sits well below the fold, so playing in the player would
    // otherwise start a video off-screen.
    const hero = document.getElementById(anchorId);
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
  }, [anchorId]);

  const stop = useCallback(() => writeBattleParam(null), []);

  const [suggestion, setSuggestion] = useState<TankVideoSuggestion | null>(null);
  // Counted, not a boolean: the tank page mounts the form twice, once per
  // layout, and the second unmount must not turn the button off for the first.
  const [forms, setForms] = useState(0);
  const registerForm = useCallback(() => {
    setForms((n) => n + 1);
    return () => setForms((n) => n - 1);
  }, []);

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
      canSuggest: forms > 0,
      registerForm,
    }),
    [
      videos,
      current,
      siblings,
      activeId,
      play,
      stop,
      suggestion,
      suggest,
      forms,
      registerForm,
    ],
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
 * The player, covering the hero while a battle is playing.
 *
 * A pixel short of the bottom, like the hero's other full-bleed layers: an
 * opaque layer flush with the edge takes most of the device row the panel's
 * bottom border falls in, and thins it out.
 */
export function TankVideoHeroPlayer() {
  const player = useTankVideoPlayer();
  if (!player?.current) return null;
  return (
    <div className="absolute inset-x-0 top-0 bottom-px z-30">
      <VideoPlayerSurface />
    </div>
  );
}
