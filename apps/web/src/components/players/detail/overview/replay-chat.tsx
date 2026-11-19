"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import type { TranslateFunction } from "@onruntime/translations";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import type { Participant } from "./battle-types";
import type { Bounds, ChatLine } from "./replay-types";
import { clock } from "./replay-math";
import { Roster } from "./replay-roster";

/**
 * A command's text with the game's own placeholders filled in.
 *
 * The client stores `Requesting fire at %(target)s!` and fills it at the moment
 * it draws the line, from the arguments in the same packet. Doing the same here
 * is the difference between a readable callout and the template that produced
 * it. A typed line has no placeholders and passes straight through.
 *
 * Anything that cannot be filled keeps its placeholder rather than being
 * guessed at or blanked: a sentence with a visible gap is a bug report, a
 * sentence quietly missing a word is a lie.
 */
function fill(
  line: ChatLine,
  byId: Map<number, Participant>,
  bounds: Bounds | null,
  tGame: TranslateFunction,
): string {
  if (!line.command) return line.text;
  // The client's own sentence in the reader's language, filed under the same
  // `msgText` key the command table carries. The English that travelled with
  // the response is the fallback, for a language that namespace has no entry
  // for: `tGame` answers with the key itself when it holds nothing.
  const said = tGame(line.command);
  const text = said && said !== line.command ? said : line.text;
  if (!text.includes("%(")) return text;
  const target = line.target == null ? undefined : byId.get(line.target);
  const named =
    target?.player?.nickname ?? target?.tank?.shortName ?? null;
  // Six names appear across the forty-one messages, and most of them are the
  // packet's OWN field names: the client formats with `**self._protoData`, so
  // the dict's keys land in the sentence as they are. Only the ones that pass
  // through `_handleHasTarget` get a computed `target`, and only one asks for a
  // minimap cell.
  return text.replace(/%\((\w+)\)[sdf]/g, (whole, key: string) => {
    switch (key) {
      case "target":
        return named ?? whole;
      // Both spellings of the same thing: the reload callouts say `floatArg1`
      // because that is the field, the artillery one says `reloadTime` because
      // its handler renames it on the way in.
      case "reloadTime":
      case "floatArg1":
        return line.reloadTime != null ? String(line.reloadTime) : whole;
      case "strArg1":
        return line.label ?? whole;
      // The objective commands print the raw number as the objective's label.
      case "int32Arg1":
        return line.target != null ? String(line.target) : whole;
      case "cellName":
      case "gridId":
        return cellOf(line.where, bounds) ?? whole;
      default:
        return whole;
    }
  });
}

/**
 * The minimap cell a place falls in, `C7`, or null without an extent.
 *
 * The game rules its minimap into ten by ten: columns A to J from the left,
 * rows 1 to 10 from the TOP, which is why the row is counted down from the
 * upper edge rather than up from the lower one. Clamped, because a ping on the
 * very border would otherwise land on an eleventh column that does not exist.
 */
function cellOf(
  where: { x: number; z: number } | null | undefined,
  bounds: Bounds | null,
): string | null {
  if (!where || !bounds) return null;
  const width = bounds.upperRight.x - bounds.bottomLeft.x;
  const height = bounds.upperRight.z - bounds.bottomLeft.z;
  if (width <= 0 || height <= 0) return null;
  const clamp = (value: number) => Math.min(9, Math.max(0, Math.floor(value * 10)));
  const column = clamp((where.x - bounds.bottomLeft.x) / width);
  const row = clamp((bounds.upperRight.z - where.z) / height);
  return `${String.fromCharCode(65 + column)}${row + 1}`;
}

/**
 * The battle chat, revealed as the clock reaches each line.
 *
 * **Everything here is a player's own typing and is treated as such.** The game
 * records the line as markup and the parser takes that apart, so what arrives
 * is plain text; it is put in the tree as a string, which React escapes, and
 * never as HTML. There is no path from a replay to markup on this page.
 *
 * Most battles have nothing to show: of six real recordings, four carried no
 * line at all. So the column has to be worth its place when empty, which is why
 * it says so rather than drawing an empty box.
 */
export function ChatColumn({
  lines,
  byId,
  bounds,
  ourTeam,
  roster,
  diedAt,
  highlightAccount,
  at,
  ticks,
  height,
  log,
  t,
}: {
  lines: ChatLine[];
  byId: Map<number, Participant>;
  /** The arena's extent, which turns a ping's metres into a minimap cell. */
  bounds: Bounds | null;
  ourTeam: number;
  /** This side's players, listed above the column as the game lists them. */
  roster: Participant[];
  /** When each vehicle died, for greying the roster as the clock passes. */
  diedAt: Map<number, number>;
  /** The page's own player, picked out in the roster. */
  highlightAccount?: number;
  at: number;
  ticks: number;
  /** The instrument's measured height, which this column matches exactly. */
  height: number;
  /** The followed player's damage log, offered as a tab beside the chat. */
  log?: ReactNode;
  t: TranslateFunction;
}) {
  const [tab, setTab] = useState<"chat" | "log">("chat");
  const box = useRef<HTMLDivElement | null>(null);
  // The game's own words for the quick commands, the same way the maps and the
  // equipment are named: looked up, never translated here.
  const { t: tGame } = useTranslation("game/chat-commands");
  const now = at * ticks;
  const said = lines.filter((line) => line.at <= now);

  // Follow the newest, the way a chat does. Keyed on the count rather than on
  // the clock, so scrubbing backwards does not fight the scroll on every
  // frame: the list only moves when a line actually joins it.
  useEffect(() => {
    const node = box.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [said.length]);

  return (
    // Same frame and same height as the instrument beside it, so the two read
    // as one object rather than a panel and a box that happen to be adjacent.
    // No heading: a column of timestamped lines beside a replay is a chat, and
    // a label over it would only be a label.
    // The same height as the instrument beside it, and a REAL height rather
    // than a stretch. `items-stretch` only sets a floor: a long conversation
    // still pushed the row taller and the panel grew instead of scrolling,
    // because `overflow-y-auto` had no height to respect. So the instrument is
    // measured and this matches it, which is also the only way the two bottom
    // edges actually line up: adding the map's width to a guess at the chrome
    // above and below it was twenty pixels out.
    //
    // Through a custom property because the cap only applies from `lg`, where
    // the two sit side by side. Stacked below that, the panel keeps its own
    // short height and the map above it is already the tall thing.
    // The roster is a fixed head and the conversation scrolls under it, so a
    // busy battle never pushes the team list out of sight.
    <div
      style={{ "--chat-height": `${height}px` } as CSSProperties}
      className="border-border bg-background/40 flex max-h-40 w-full max-w-lg min-w-0 flex-col overflow-hidden rounded-lg border text-xs lg:max-h-[var(--chat-height)] lg:min-w-0 lg:flex-1 lg:basis-0 lg:max-w-none"
    >
      <Roster
        side={roster}
        diedAt={diedAt}
        highlightAccount={highlightAccount}
        ally
        at={at}
        ticks={ticks}
      />
      {/* The chat and the followed player's damage log share the column, as
          the game keeps both in the same corner. */}
      {log ? (
        <div className="border-border/50 flex border-b text-[11px]" role="tablist">
          {(["chat", "log"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "flex-1 cursor-pointer px-3 py-1.5 font-medium uppercase tracking-wide transition-colors",
                tab === key
                  ? "text-foreground border-brand border-b-2"
                  : "text-muted-foreground hover:text-foreground border-b-2 border-transparent",
              )}
            >
              {t(`replay.tab.${key}`)}
            </button>
          ))}
        </div>
      ) : null}
      {log && tab === "log" ? log : (
      <div
        ref={box}
        // A column, so the line saying there is nothing yet can fill it and sit
        // in its middle, as the damage log's does.
        className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 py-2"
      >
      <div
        className={cn(
          "flex-1",
          // Nothing to read: the line sits in the middle of the panel rather
          // than clinging to its top edge, where it would read as the first of
          // a list that never came.
          said.length === 0 && "flex items-center justify-center text-center",
        )}
      >
        {said.length === 0 ? (
          <p className="text-muted-foreground/60 max-w-[22ch] leading-relaxed text-pretty">
            {lines.length === 0 ? t("replay.chat-none") : t("replay.chat-yet")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {said.map((line, index) => {
              // A command names its sender by vehicle id, so it is resolved
              // against the battle's own list and shown only when it matches:
              // the field is not that for every command, and half a name is
              // worse than none.
              // A typed line names its author by nickname instead, matched
              // against the same list so its side follows the focus too.
              const who =
                line.sender != null
                  ? byId.get(line.sender)
                  : [...byId.values()].find(
                      // The client writes the clan after the name, `Name[TAG]`.
                      (one) => one.player?.nickname === line.from.replace(/\[[^\]]*\]$/, ""),
                    );
              const name = line.command
                ? (who?.player?.nickname ?? who?.tank?.shortName ?? null)
                : line.from;
              const ally = who ? who.team === ourTeam : line.ally;
              // A command no vehicle sent: the countdown's destination marker,
              // relayed by the arena itself with the battle's id as sender, so
              // nobody's side to colour it with.
              const unsigned = line.command !== null && line.command !== undefined && !who;
              return (
                // `overflow-wrap: anywhere` rather than `break-words`, which
                // broke "Attention" across two lines mid-word, or `break-all`,
                // which breaks every word mid-word. This one wraps at spaces
                // like prose and only cuts into a word when the word genuinely
                // cannot fit: a player typed sixty unbroken characters and the
                // column grew a horizontal scrollbar.
                // The WHOLE line takes the side's colour, which is what the
                // game does: a chat line is read first as "one of mine" or
                // "one of theirs", and colouring only the name left the part
                // that matters in neutral grey. The vehicle and the colon stay
                // dimmed against it so the sentence still has a shape.
                <li
                  key={`${line.at}-${index}`}
                  className={cn(
                    "leading-relaxed [overflow-wrap:anywhere]",
                    unsigned ? "text-muted-foreground" : ally ? "text-emerald-400" : "text-red-400",
                  )}
                >
                  <span className="text-muted-foreground/45 mr-1.5 text-[10px] tabular-nums">
                    {clock(line.at / ticks)}
                  </span>
                  {name ? (
                    <>
                      <span
                        className={cn(
                          who?.account !== undefined &&
                            who.account === highlightAccount &&
                            "text-amber-300",
                        )}
                      >
                        <span className="font-medium">{name}</span>
                        <span className="opacity-60">
                          {line.vehicle ? ` (${line.vehicle})` : ""}
                        </span>
                      </span>
                      <span className="mx-1 opacity-50">:</span>
                    </>
                  ) : null}
                  {/* A quick command reads exactly like a typed line, because
                      that is how the game shows it. Marking it apart was an
                      invention of this page, and an invention a reader stops on
                      to wonder about is one that costs more than it carries. */}
                  <span>{fill(line, byId, bounds, tGame)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </div>
      )}
    </div>
  );
}
