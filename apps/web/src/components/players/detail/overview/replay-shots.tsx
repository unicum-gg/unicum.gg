"use client";

import { projectPoint } from "@unicum.gg/shared";
import { cn } from "@/lib/utils";

/** One shell, as the replay endpoint hands it over. */
export type ReplayShot = {
  at: number;
  by: number;
  from: [number, number];
  to: [number, number];
  endAt: number | null;
  landed: boolean;
  victim: number | null;
  ricochet: boolean;
};

/** How long a shell's trace stays after it lands, in battle seconds. */
const TRACE_LIFE = 3;

/** How long a shell with no known end is drawn flying, in battle seconds. */
const UNSEEN_FLIGHT = 0.5;

/**
 * The shells in flight and just landed, drawn over the map: a trace that runs
 * from the muzzle to where the shell is, then holds from muzzle to impact and
 * fades, with a burst where it landed. A shell whose end the recording never
 * saw is dashed and goes only as far as its heading, which is all that is
 * known about it.
 *
 * One SVG over the whole map in its own percentage frame, the frame
 * `projectPoint` answers in, so a trace lines up with the markers exactly.
 */
export function ShotLayer({
  shots,
  at,
  ticks,
  bounds,
  colourOf,
}: {
  shots: ReplayShot[];
  /** The replay's position, in seconds. */
  at: number;
  ticks: number;
  bounds: Parameters<typeof projectPoint>[1];
  /** The text colour class of the side that fired, for the trace. */
  colourOf: (by: number) => string;
}) {
  const now = at * ticks;
  const live = shots.filter((shot) => {
    const end = shot.endAt ?? shot.at + UNSEEN_FLIGHT * ticks;
    return now >= shot.at && now <= end + TRACE_LIFE * ticks;
  });
  if (live.length === 0) return null;
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 size-full"
    >
      {live.map((shot, index) => {
        const from = projectPoint({ x: shot.from[0], z: shot.from[1] }, bounds);
        const to = projectPoint({ x: shot.to[0], z: shot.to[1] }, bounds);
        const end = shot.endAt ?? shot.at + UNSEEN_FLIGHT * ticks;
        const flying = now < end;
        const share = flying ? (now - shot.at) / Math.max(1, end - shot.at) : 1;
        const tip = {
          left: from.left + (to.left - from.left) * share,
          top: from.top + (to.top - from.top) * share,
        };
        // Fully drawn while it flies and as it lands, then gone over the
        // trace's life.
        const fade = flying ? 1 : Math.max(0, 1 - (now - end) / (TRACE_LIFE * ticks));
        return (
          <g key={`${shot.at}-${shot.by}-${index}`} className={cn(colourOf(shot.by))} opacity={fade}>
            <line
              x1={from.left}
              y1={from.top}
              x2={tip.left}
              y2={tip.top}
              stroke="currentColor"
              strokeWidth={shot.victim ? 2 : 1.25}
              strokeDasharray={shot.landed ? undefined : "4 3"}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {!flying && shot.landed ? (
              // The burst: a vehicle struck reads louder than a shell in the
              // dirt, the way the game's own hit effect does.
              <circle
                cx={to.left}
                cy={to.top}
                r={shot.victim ? 0.9 : 0.5}
                fill="currentColor"
                stroke="black"
                strokeOpacity={0.5}
                strokeWidth={0.6}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
