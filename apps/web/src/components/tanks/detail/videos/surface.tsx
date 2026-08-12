"use client";

import { useEffect, useMemo, useState } from "react";
import { PlusIcon, XIcon } from "@phosphor-icons/react";
import { MAP_GAME_MODE_LABEL } from "@unicum.gg/shared";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { ActiveBattleTracker } from "./active-battle-tracker";
import { CHROME_BUTTON, useTankVideoPlayer } from "./player";
import dynamic from "next/dynamic";

/** The player library is only worth downloading once someone plays something,
 * and it drives an embed, so there is nothing for the server to render. */
const PlyrPlayer = dynamic(() => import("./plyr-player"), { ssr: false });

/**
 * The battle being played, and the only chrome drawn over it.
 *
 * Sits on black rather than stretching to whatever box it is given: a battle
 * recording is 16:9 and cropping it would cut the part of the screen the
 * suggestion is about. Where that box is, and what shape it takes, is the
 * caller's business: the tank page lays it over its hero, a map page gives it a
 * band of its own above the list.
 */
export function VideoPlayerSurface() {
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
    <div className="relative size-full bg-black">
      {/* Fills whatever box the caller drew, which is already 16:9, so the
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
