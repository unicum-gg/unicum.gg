"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type RefObject } from "react";
import {
  useMediaRemote,
  useMediaStore,
  type MediaPlayerInstance,
} from "@vidstack/react";
import { formatTimestamp } from "@unicum.gg/shared";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

/** The same player the hero plays published battles in, so a suggestion is
 * previewed in what it will look like once approved. */
const PlyrPlayer = dynamic(() => import("./plyr-player"), { ssr: false });

/**
 * Preview of the video being suggested, with a scrubber that sets the moment
 * the battle starts.
 *
 * The point is to remove the round trip: without this, picking a timestamp
 * means opening YouTube in another tab, finding the battle, copying the link
 * again with "start at current time", and coming back. Here the player is the
 * field: move to where the battle starts, and that is the value submitted.
 */
export function VideoScrubber({
  videoId,
  seconds,
  onChange,
}: {
  videoId: string;
  /** Current start time, so the preview opens where the field already points. */
  seconds: number;
  onChange: (seconds: number) => void;
}) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const [attached, setAttached] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
        <PlyrPlayer
          videoId={videoId}
          title="Video being suggested"
          playerRef={playerRef}
          // Opens where the field already points.
          startSeconds={seconds}
          // Muted, so the browser lets it start on its own. Starting is what
          // loads the metadata the duration comes from, and sound in a form
          // nobody asked to play is worse than one click on unmute.
          autoPlay
          muted
          onCanPlay={() => setAttached(true)}
        />
      </div>

      <ScrubberControls
        // Remounted once the player exists. The store subscription is taken on
        // the controls' first render, and the player arrives a commit later
        // (it is imported on demand), so a subscription taken before that would
        // stay empty for good.
        key={attached ? "attached" : "pending"}
        playerRef={playerRef}
        seconds={seconds}
        onChange={onChange}
      />
    </div>
  );
}

function ScrubberControls({
  playerRef,
  seconds,
  onChange,
}: {
  playerRef: RefObject<MediaPlayerInstance | null>;
  seconds: number;
  onChange: (seconds: number) => void;
}) {
  // Subscribed rather than polled: the player publishes its own state, so the
  // slider follows the playhead with no interval of ours to keep alive.
  const { currentTime, duration } = useMediaStore(playerRef);
  const remote = useMediaRemote(playerRef);
  /**
   * The moment picked, once one has been.
   *
   * Until then the slider follows the playhead, which is what makes watching up
   * to the battle and pressing the button below work. After that it holds still,
   * because it is a form field and not a playback indicator: it used to keep
   * tracking, so a video left running while the rest of the form was filled in
   * moved the value under the person filling it, and a battle picked at 3:54 was
   * submitted at 5:28.
   */
  const [chosen, setChosen] = useState<number | null>(
    seconds > 0 ? seconds : null,
  );

  const ready = duration > 0;
  const position = Math.floor(chosen ?? currentTime);

  function seek(next: number) {
    setChosen(next);
    // Stopped on the frame being submitted, so the timestamp can be checked
    // against what is on screen. Suggestions are refused for being a few
    // seconds off, which is not something a moving picture lets anyone verify.
    remote.pause();
    remote.seek(next);
    onChange(next);
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={ready ? Math.floor(duration) : 0}
          // One second per arrow press: the coarse move is the drag, and this
          // is what lands on the exact frame the battle starts.
          step={1}
          value={position}
          disabled={!ready}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Moment the battle starts"
          className="h-1 flex-1 cursor-pointer accent-brand"
        />
        <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums">
          {formatTimestamp(position)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Dragging is for finding the spot roughly; this is for the case where
            you just watched up to it. Both write the same field. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!ready}
          onClick={() => seek(Math.floor(currentTime))}
        >
          Use the current moment
        </Button>
        {/* The way back. Playing on with the player's own controls moves the
            playhead without touching the field, which is what you want when
            checking the rest of the battle, and this returns to the second
            being submitted rather than making anyone hunt for it again. */}
        {seconds > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!ready}
            onClick={() => seek(seconds)}
          >
            Back to {formatTimestamp(seconds)}
          </Button>
        )}
        {/* Dragging cannot be precise on a long video, a pixel being a dozen
            seconds on a three-hour VOD, and the slider keeps focus after a
            drag, so the arrow keys are the way to land on the right second.
            Worth saying plainly, since an imprecise timestamp is refused. */}
        {/* Plain inline text, not a flex row: as a flex container every word
            either side of the keycaps became its own item, so the sentence
            broke around them instead of flowing. `Kbd` is already
            `inline-flex align-middle` for exactly this. */}
        <span className="flex-1 text-xs text-fd-muted-foreground">
          Drag to the battle, then adjust with <Kbd>←</Kbd> <Kbd>→</Kbd>, one
          second per press. The video pauses on the moment you pick, and stays
          there while you fill in the rest.
        </span>
      </div>
    </>
  );
}
