"use client";

import { useEffect, useRef } from "react";
import {
  CrosshairIcon,
  HandshakeIcon,
  HeartBreakIcon,
  ShieldIcon,
  WrenchIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { TranslateFunction } from "@onruntime/translations";
import { iconUrl } from "@unicum.gg/shared";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { cn } from "@/lib/utils";
import type { Participant } from "./battle-types";
import type { Motion } from "./replay-types";
import { clock } from "./replay-math";

/** What a line of the log says happened. */
enum LogKind {
  Dealt = "dealt",
  Received = "received",
  Blocked = "blocked",
  Assist = "assist",
  Crit = "crit",
  ReceivedCrit = "received-crit",
  Module = "module",
}

type LogLine = {
  at: number;
  kind: LogKind;
  /** Hit points, or the number of critical hits for a crit. */
  amount: number;
  /** The other vehicle: the target, or whoever did it. */
  other: number | null;
  /** For a hit to one of the recorder's own parts: its icon. */
  module?: string;
};

/** The client's `BATTLE_EVENT_TYPE` values and what each is in the log. */
const FEED_KIND: Record<number, LogKind> = {
  1: LogKind.Assist,
  2: LogKind.Assist,
  5: LogKind.Blocked,
  6: LogKind.Crit,
  7: LogKind.Dealt,
  9: LogKind.ReceivedCrit,
  10: LogKind.Received,
  11: LogKind.Assist,
};

const ICON: Record<LogKind, Icon | null> = {
  [LogKind.Dealt]: CrosshairIcon,
  [LogKind.Received]: HeartBreakIcon,
  [LogKind.Blocked]: ShieldIcon,
  [LogKind.Assist]: HandshakeIcon,
  [LogKind.Crit]: WrenchIcon,
  [LogKind.ReceivedCrit]: WrenchIcon,
  [LogKind.Module]: null,
};

/** The recorder's own part each extra stands for, by its crit icon's name. */
const PART: Record<number, string> = {
  61: "engine",
  62: "ammoBay",
  63: "fuelTank",
  64: "radio",
  65: "track",
  66: "track",
  67: "gun",
  68: "turretRotator",
  69: "surveyingDevice",
};

/** `DAMAGE_INFO_CODES` that destroy the part rather than damage it. */
const DESTROYING = new Set([1, 4, 6, 10, 12, 14, 22, 24]);
/** `DAMAGE_INFO_CODES` that damage it. */
const DAMAGING = new Set([0, 3, 5, 9, 11, 13, 15, 21, 23]);

/**
 * The followed player's damage log, as the game keeps it in the corner of the
 * screen: what they dealt, what they took and from whom, what their armour
 * stopped, and which of their parts were hit, revealed as the clock reaches
 * each line.
 *
 * The recorder's comes from their own battle feed, which is the game's log
 * itself (hits on a target they could not see are left out, as the game left
 * them out); anybody else's is built from the hits the recording heard, which
 * covers only what the recorder's client was told about.
 */
export function DamageLog({
  focused,
  recorder,
  motion,
  byId,
  at,
  ticks,
  t,
}: {
  focused: Participant;
  recorder: boolean;
  motion: Motion;
  byId: Map<number, Participant>;
  at: number;
  ticks: number;
  t: TranslateFunction;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const now = at * ticks;
  const lines: LogLine[] = [];
  if (recorder && motion.events?.length) {
    for (const [when, type, target, amount] of motion.events) {
      const kind = FEED_KIND[type];
      if (kind && (amount > 0 || kind === LogKind.Blocked)) {
        lines.push({ at: when, kind, amount, other: target || null });
      }
    }
    for (const [when, extra, code] of motion.ownDamage ?? []) {
      const part = PART[extra];
      if (!part || !(DESTROYING.has(code) || DAMAGING.has(code))) continue;
      lines.push({
        at: when,
        kind: LogKind.Module,
        amount: DESTROYING.has(code) ? 2 : 1,
        other: null,
        module: part,
      });
    }
  } else {
    for (const [when, by, victim, damage] of motion.hits ?? []) {
      if (by === focused.id) lines.push({ at: when, kind: LogKind.Dealt, amount: damage, other: victim });
      else if (victim === focused.id) {
        lines.push({ at: when, kind: LogKind.Received, amount: damage, other: by });
      }
    }
  }
  const shown = lines.filter((line) => line.at <= now).sort((a, b) => a.at - b.at);

  // Follow the newest, like the chat beside it, only when a line joins.
  useEffect(() => {
    const node = box.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [shown.length]);

  if (shown.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 text-center">
        <p className="text-muted-foreground/60 max-w-[24ch] leading-relaxed text-pretty">
          {t("replay.log.empty")}
        </p>
      </div>
    );
  }
  return (
    <div ref={box} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-2">
      <ul className="flex flex-col gap-1.5">
        {shown.map((line, index) => {
          const other = line.other ? byId.get(line.other) : undefined;
          const Mark = ICON[line.kind];
          // As the game draws it: only the icon carries the colour, green for
          // what the player did (dealt, critical hits, assistance) and red for
          // what they took; the figure and the vehicle stay plain.
          const good =
            line.kind === LogKind.Dealt || line.kind === LogKind.Crit || line.kind === LogKind.Assist;
          const bad = line.kind === LogKind.Received || line.kind === LogKind.ReceivedCrit || line.kind === LogKind.Module;
          const side = other ? "text-foreground" : "text-muted-foreground";
          return (
            <li key={`${line.at}-${index}`} className="flex items-center gap-2 leading-none">
              <span className="text-muted-foreground/45 w-7 shrink-0 text-[10px] tabular-nums">
                {clock(line.at / ticks)}
              </span>
              <span
                className={cn(
                  "w-10 shrink-0 text-end font-semibold tabular-nums",
                  "text-foreground",
                )}
              >
                {line.kind === LogKind.Module
                  ? ""
                  : line.kind === LogKind.Crit || line.kind === LogKind.ReceivedCrit
                    ? `×${line.amount}`
                    : line.amount}
              </span>
              {line.module ? (
                // eslint-disable-next-line @next/next/no-img-element -- the game's 18px crit icon
                <img
                  src={iconUrl(
                    `library/crits/${line.module}${line.amount === 2 ? "Destroyed" : "Critical"}Small.png`,
                  )}
                  alt=""
                  width={16}
                  height={16}
                  className="size-4 shrink-0"
                />
              ) : Mark ? (
                <Mark
                  className={cn(
                    "size-3.5 shrink-0",
                    good ? "text-emerald-400" : bad ? "text-red-400" : "text-muted-foreground",
                  )}
                  aria-label={t(`replay.log.kind.${line.kind}`)}
                />
              ) : null}
              {line.module ? (
                <span className="text-muted-foreground min-w-0 truncate">
                  {`${t(`replay.hud.part.${line.module}`)} · ${t(
                    `replay.hud.state.${line.amount === 2 ? "destroyed" : "damaged"}`,
                  )}`}
                </span>
              ) : other ? (
                <span className={cn("flex min-w-0 items-center gap-1", side)}>
                  {other.tank?.type ? (
                    <VehicleTypeIcon type={other.tank.type} size={10} className="shrink-0" />
                  ) : null}
                  <span className="truncate">{other.tank?.shortName ?? other.player?.nickname ?? ""}</span>
                </span>
              ) : (
                <span className="text-muted-foreground truncate">{t(`replay.log.kind.${line.kind}`)}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
