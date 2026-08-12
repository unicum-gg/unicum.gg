"use client";

import { useCallback, useMemo, useRef, type RefObject } from "react";
import {
  MediaPlayer,
  MediaProvider,
  useMediaRemote,
  type MediaPlayerInstance,
} from "@vidstack/react";
import {
  PlyrLayout,
  plyrLayoutIcons,
  type PlyrMarker,
} from "@vidstack/react/player/layouts/plyr";
import "@vidstack/react/player/styles/base.css";
import "@vidstack/react/player/styles/plyr/theme.css";
import { cn } from "@/lib/utils";

/**
 * Every YouTube embed on the tank page, published or being suggested.
 *
 * YouTube's own controls come with its title bar, its channel avatar and its
 * end-of-video wall of unrelated suggestions, all of which sit on top of a
 * battle someone submitted for this tank. Driving the embed ourselves replaces
 * that with controls that look like the rest of the site.
 *
 * Loaded on demand by both callers (`next/dynamic`): this pulls in the whole
 * player library, and a tank page nobody plays a video on should not pay for
 * it. Same reasoning as the lazy chart boundaries.
 */
export default function TankVideoPlyrPlayer({
  videoId,
  title,
  startSeconds = 0,
  autoPlay = false,
  muted = false,
  playerRef,
  onCanPlay,
  toolbar,
  markers,
  className,
}: {
  videoId: string;
  title: string;
  /** Where playback opens. A position, not a boundary: the whole recording
   * stays seekable, so you can rewind before the battle to see how it was set
   * up, or past a timestamp a submitter placed a few seconds late. */
  startSeconds?: number;
  autoPlay?: boolean;
  muted?: boolean;
  /** For a caller that reads the playhead back, like the suggestion form. */
  playerRef?: RefObject<MediaPlayerInstance | null>;
  onCanPlay?: () => void;
  /** Extra control dropped into the bottom bar, left of the settings menu.
   * The layout's slot names take a `before`/`after` prefix to insert rather
   * than replace, so this sits among the player's own controls instead of
   * floating over the video. `beforeSettings` targets the menu's wrapper:
   * `beforeSettingsButton` lands INSIDE it, nesting a button in a button. */
  toolbar?: React.ReactNode;
  /** Ticks on the seek bar, one per battle marked in this video, so the others
   * are visible from the one being watched instead of only in the list below. */
  markers?: PlyrMarker[];
  className?: string;
}) {
  const innerRef = useRef<MediaPlayerInstance>(null);
  const remote = useMediaRemote(innerRef);
  const seededRef = useRef(false);

  // Memoized: an inline arrow is a new callback on every render, so React
  // detaches and reattaches the ref each time. The player took that as being
  // torn down and never settled a duration, which left the seek bar dead.
  const attachRef = useCallback(
    (player: MediaPlayerInstance | null) => {
      innerRef.current = player;
      if (playerRef) playerRef.current = player;
    },
    [playerRef],
  );

  // Memoized so the layout is not handed a new slot map on every render.
  const slots = useMemo(
    () => (toolbar ? { beforeSettings: toolbar } : undefined),
    [toolbar],
  );

  return (
    <MediaPlayer
      ref={attachRef}
      // The nocookie host, like every other embed on the site.
      src={`youtube/${videoId}`}
      // Clipped from zero, which cuts nothing and is not the no-op it looks
      // like. Unclipped, the YouTube provider never settles a duration: it
      // reads the video as a live stream, and the seek bar comes out disabled
      // with `LIVE` where the time should be. Clipping from the start is what
      // makes it resolve.
      clipStartTime={0}
      title={title}
      autoPlay={autoPlay}
      muted={muted}
      playsInline
      // Both callers already mount this only on demand (a click on a card, a
      // valid link pasted into the form), so there is nothing left to defer.
      // It also has to be eager for the form: the duration is what its slider
      // is scaled to, and waiting for a first play would leave it disabled.
      load="eager"
      onCanPlay={() => {
        // Once, so it never fights a seek made afterwards.
        if (!seededRef.current) {
          seededRef.current = true;
          if (startSeconds > 0) remote.seek(startSeconds);
        }
        onCanPlay?.();
      }}
      // Plyr's own variables, pointed at our tokens: the layout ships Sam
      // Potts' blue, which is the one thing about it that would not look like
      // the rest of the site.
      className={cn(
        // `tank-video-player` is the hook for the few rules that need a real
        // selector rather than a variable, in `styles/custom.css`.
        // The radius is Plyr's own (10px on its root). The hero is a full-bleed
        // panel with square corners and the form's preview has its own rounded
        // box clipping it, so in both places the player's corners are one
        // rounding too many.
        "tank-video-player size-full [--plyr-border-radius:0] [--plyr-color-main:var(--color-brand)] [--plyr-video-background:transparent]",
        className,
      )}
    >
      <MediaProvider />
      <PlyrLayout icons={plyrLayoutIcons} slots={slots} markers={markers} />
    </MediaPlayer>
  );
}
