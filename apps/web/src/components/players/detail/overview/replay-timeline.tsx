"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { TranslateFunction } from "@onruntime/translations";
import { DEATH_MESSAGE_CODE } from "@unicum.gg/shared";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import type { Participant } from "./battle-types";
import type { Death } from "./replay-types";
import { clock } from "./replay-math";
import { Roster } from "./replay-roster";

/**
 * A feed sentence with its two names put back, each in its side's colour.
 *
 * The client writes `%(attacker)s destroyed %(target)s.` and fills both holes
 * with a name it has already coloured. Splitting on the holes rather than
 * replacing into a string is what lets each name carry its own colour and its
 * vehicle, and it keeps a player's own characters out of anything but a text
 * node.
 */
function named(
  text: string,
  parts: {
    at: string;
    who: { name: string | null; tank: string | null; mine?: boolean } | null;
  }[],
) {
  const pattern = /%\((attacker|target)\)s/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const part = parts.find((one) => one.at === match![1]);
    out.push(
      // The focused player's name and vehicle in their own yellow, whatever
      // the line's verdict, as everywhere else they appear.
      <span
        key={`n${key++}`}
        className={cn("inline-block", part?.who?.mine && "text-amber-300")}
      >
        <span className="font-medium">{part?.who?.name ?? "?"}</span>
        {part?.who?.tank ? (
          <span className="opacity-70">{` (${part.who.tank})`}</span>
        ) : null}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  // No colour of its own: the line above it already carries the one verdict.
  return <>{out}</>;
}

/**
 * Who died, and to whom, as the clock reaches each one.
 *
 * The mirror of the chat on the other side of the map: the same panel, the same
 * height, the same reveal. What it shows is the battle's other running story,
 * and the two together are most of what a replay is for.
 *
 * **Its two halves come from different places and that is deliberate.** The
 * instant is the battle's own results, which know about a tank nobody watched
 * die; the killer is the recording, which only speaks for what that client
 * could see. So a row with no killer is not a gap in the data, it is a death
 * that happened out of sight, and it says so by naming only the victim.
 */
export function Timeline({
  deaths,
  byId,
  ourTeam,
  roster,
  diedAt,
  highlightAccount,
  at,
  ticks,
  height,
  t,
}: {
  deaths: Death[];
  byId: Map<number, Participant>;
  ourTeam: number;
  /** This side's players, listed above the column as the game lists them. */
  roster: Participant[];
  /** When each vehicle died, for greying the roster as the clock passes. */
  diedAt: Map<number, number>;
  /** The page's own player, whom the game words differently: "Vehicle was…". */
  highlightAccount?: number;
  at: number;
  ticks: number;
  height: number;
  t: TranslateFunction;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const now = at * ticks;
  const done = deaths.filter((death) => death.at <= now);

  useEffect(() => {
    const node = box.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [done.length]);

  // The battle feed's own sentence for a destruction, which a replay carries
  // only as a reason code.
  const { t: tFeed } = useTranslation("game/battle-messages");
  /**
   * Whether this death went our way, which colours the WHOLE line.
   *
   * Not the sides of the two names: the event has one meaning and it is read
   * at a glance. A dead enemy is green whoever killed them, a dead ally is red
   * even when an ally did it, because a team kill is not good news. Reading
   * green or red down the column is then reading how the battle went.
   */
  const good = (death: Death) => {
    const victim = byId.get(death.victim);
    if (!victim) return null;
    return victim.team !== ourTeam;
  };
  /** The player, with their vehicle as the detail beside it, or null. */
  const who = (id: number | null) => {
    const found = id === null ? undefined : byId.get(id);
    if (!found) return null;
    return {
      name: found.player?.nickname ?? found.tank?.shortName ?? null,
      tank: found.player?.nickname ? (found.tank?.shortName ?? null) : null,
      mine: found.account !== undefined && found.account === highlightAccount,
    };
  };

  /**
   * The name the client gives a vehicle's bench.
   *
   * Never `SELF`, although the client has it: those sentences are written to
   * the person at the keyboard and leave them unnamed ("Pz. 55 destroyed."
   * means "you destroyed it"), which on a page read by anybody but the recorder
   * lost the killer's name entirely. The page is in the third person, so the
   * recorder is an ally like any other and is named like one.
   */
  const sides = (id: number | null) => {
    const found = id === null ? undefined : byId.get(id);
    if (!found) return [];
    return [found.team === ourTeam ? "ALLY" : "ENEMY"];
  };

  /**
   * The sentence the battle feed would have printed for this death.
   *
   * Every spelling the client might have for this pair, in order, and the first
   * that exists wins. `SELF` leads because it is the most specific, and the
   * plain bench follows because most causes have nothing else.
   *
   * With no attacker, two different things are tried and they are not the same
   * claim: `UNKNOWN` is "somebody did this and we did not see who", which the
   * game words as "Enemy (Unknown) destroyed X", and the suicide form is
   * "nobody did this". A recording that lost sight of the shot wants the first.
   */
  const sentence = (death: Death) => {
    const cause = (DEATH_MESSAGE_CODE[death.reason ?? 0] ?? "DEATH_FROM_SHOT")
      .replace("DEATH_", "");
    // The results name the killer of every death, the recording only of a shot
    // its client saw, so "Enemy (Unknown)" is kept for when neither knows.
    const named = death.by ?? byId.get(death.victim)?.own.killer ?? null;
    const by = !named || named === death.victim ? null : named;
    const victims = sides(death.victim);
    const keys: string[] = [];
    for (const target of victims) {
      if (by) for (const attacker of sides(by)) keys.push(`${cause}_${attacker}_${target}`);
      else keys.push(`${cause}_UNKNOWN_${target}`, `${cause}_${target}_SUICIDE`);
    }
    for (const key of keys) {
      const said = tFeed(key);
      if (said && said !== key) return { text: said, by };
    }
    // Nothing matched, so the row still names who died: a blank line is the one
    // outcome a reader cannot interpret.
    return { text: null, by };
  };

  return (
    <div
      style={{ "--timeline-height": `${height}px` } as CSSProperties}
      className="border-border bg-background/40 flex max-h-40 w-full max-w-lg min-w-0 flex-col overflow-hidden rounded-lg border text-xs lg:max-h-[var(--timeline-height)] lg:min-w-0 lg:flex-1 lg:basis-0 lg:max-w-none"
    >
      <Roster
        side={roster}
        diedAt={diedAt}
        highlightAccount={highlightAccount}
        ally={false}
        at={at}
        ticks={ticks}
      />
      <div
        ref={box}
        // A column, so the line saying there is nothing yet can fill it and sit
        // in its middle, as the damage log's does.
        className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 py-2"
      >
      <div
        className={cn(
          "flex-1",
          done.length === 0 && "flex items-center justify-center text-center",
        )}
      >
        {done.length === 0 ? (
          <p className="text-muted-foreground/60 max-w-[22ch] leading-relaxed text-pretty">
            {deaths.length === 0 ? t("replay.deaths-none") : t("replay.deaths-yet")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {done.map((death, index) => {
              const victim = who(death.victim);
              const said = sentence(death);
              const verdict = good(death);
              return (
                <li
                  key={`${death.at}-${index}`}
                  className={cn(
                    "leading-relaxed [overflow-wrap:anywhere]",
                    verdict === null
                      ? "text-muted-foreground"
                      : verdict
                        ? "text-emerald-400"
                        : "text-red-400",
                  )}
                >
                  <span className="text-muted-foreground/45 mr-1.5 text-[10px] tabular-nums">
                    {clock(death.at / ticks)}
                  </span>
                  {/* The feed's own sentence, in the one colour the whole line
                      takes. Never empty: a row that resolved to no message
                      still says who died, which is the part a reader came
                      for. */}
                  {said.text
                    ? named(said.text, [
                        { at: "attacker", who: who(said.by) },
                        { at: "target", who: victim },
                      ])
                    : named("%(target)s", [{ at: "target", who: victim }])}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}
