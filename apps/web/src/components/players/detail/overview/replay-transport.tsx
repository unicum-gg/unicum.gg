"use client";

import { plyrLayoutIcons } from "@vidstack/react/player/layouts/plyr";
import type { TranslateFunction } from "@onruntime/translations";
import { Slider } from "@/components/ui/slider";
import { clock } from "./replay-math";

/**
 * The transport, drawn as the site's video player draws its own (the
 * Plyr layout in the brand colour): the same icons, a borderless
 * button that fills with the brand on hover, a thin rail filled in the
 * brand with a white handle, and the time in the same small type. One
 * player across the site, whether it plays a video or a battle.
 */
/** The rates offered, in battle seconds per second: real time up to a battle
 * in under a minute. */
const SPEEDS = [1, 2, 4, 8, 16];

export function Transport({
  at,
  duration,
  playing,
  ended,
  setAt,
  setPlaying,
  speed,
  setSpeed,
  t,
}: {
  at: number;
  duration: number;
  playing: boolean;
  ended: boolean;
  setAt: (at: number) => void;
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  /** Battle seconds per second of playback. */
  speed: number;
  setSpeed: (speed: number) => void;
  t: TranslateFunction;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <button
        type="button"
        onClick={() => {
          // From the end, play means from the start again, as a video
          // player's replay button does: resuming at the last frame stopped
          // on the next one.
          if (!playing && ended) setAt(0);
          setPlaying((p) => !p);
        }}
        aria-label={
          playing ? t("replay.pause") : ended ? t("replay.restart") : t("replay.play")
        }
        className="hover:bg-brand focus-visible:bg-brand focus-visible:ring-brand/40 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[4px] transition-colors outline-none hover:text-white focus-visible:text-white focus-visible:ring-3"
      >
        {playing ? (
          <plyrLayoutIcons.Pause className="size-[18px] fill-current" />
        ) : ended ? (
          <plyrLayoutIcons.Restart className="size-[18px] fill-current" />
        ) : (
          <plyrLayoutIcons.Play className="size-[18px] fill-current" />
        )}
      </button>
      <Slider
        value={[at]}
        min={0}
        max={Math.max(1, duration)}
        step={0.5}
        onValueChange={([value]) => {
          setPlaying(false);
          setAt(value);
        }}
        className="flex-1 [&_[data-slot=slider-range]]:bg-brand [&_[data-slot=slider-thumb]]:size-[13px] [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:shadow-[0_1px_1px_rgba(35,40,47,0.15),0_0_0_1px_rgba(35,40,47,0.2)] [&_[data-slot=slider-thumb]]:ring-brand/30 [&_[data-slot=slider-track]]:h-[5px]"
      />
      <span className="shrink-0 text-[13px] tabular-nums">
        {clock(at)}
        <span className="text-muted-foreground"> / {clock(duration)}</span>
      </span>
      {/* The speed: one click, the next rate, back to the first after the
          last, rather than a menu to open for a choice of five. */}
      <button
        type="button"
        onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
        aria-label={t("replay.speed")}
        title={t("replay.speed")}
        className="hover:bg-brand focus-visible:bg-brand focus-visible:ring-brand/40 inline-flex h-8 min-w-10 shrink-0 cursor-pointer items-center justify-center rounded-[4px] px-1.5 text-[13px] font-medium tabular-nums transition-colors outline-none hover:text-white focus-visible:text-white focus-visible:ring-3"
      >
        {`${speed}×`}
      </button>
    </div>
  );
}
