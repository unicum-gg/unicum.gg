"use client";

import { projectPoint } from "@unicum.gg/shared";
import { cn } from "@/lib/utils";
import type { Participant } from "./battle-types";
import type { Bounds, ChatLine } from "./replay-types";

/**
 * How long a ping stays on the map, in seconds.
 *
 * The game's own cooldown for repeating a command, which is also about as long
 * as its marker lives. Long enough to be caught while scrubbing, short enough
 * that a busy minute does not become a field of rings.
 */
const PING_LIFE = 5;

/**
 * The places somebody pointed at, under the vehicles: a marker is a place, and
 * a tank standing on it should read as on top of it, the way the bases do.
 */
export function PingLayer({
  chat,
  byId,
  ourTeam,
  at,
  ticks,
  bounds,
  markerPx,
}: {
  chat: ChatLine[];
  byId: Map<number, Participant>;
  ourTeam: number;
  at: number;
  ticks: number;
  bounds: Bounds;
  markerPx: number;
}) {
  return (
    <>
      {chat.map((line, index) => {
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
        })}
    </>
  );
}
