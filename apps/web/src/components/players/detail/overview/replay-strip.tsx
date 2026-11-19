"use client";

import { useMemo } from "react";
import type { TranslateFunction } from "@onruntime/translations";
import { Hint } from "@/components/hint";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { cn } from "@/lib/utils";
import type { Participant } from "./battle-types";
import type { Track } from "./replay-types";
import { classRank, hpAt, SURVIVED } from "./replay-math";

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
export function TeamStrip({
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
