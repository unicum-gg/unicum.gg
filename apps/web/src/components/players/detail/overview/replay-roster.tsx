"use client";

import { createContext, useContext, useMemo } from "react";
import { EyeIcon, EyeSlashIcon, LightbulbFilamentIcon } from "@phosphor-icons/react";
import type { Region } from "@unicum.gg/wargaming";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { TankIcon } from "@/components/tanks/tank-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import type { Participant } from "./battle-types";
import type { Track } from "./replay-types";
import { classRank, healthAt, pathOf, pointAt } from "./replay-math";

/**
 * What the rosters need beyond their own side: the region their vehicles are
 * pictured from, and every kill with the clock tick it happened at, so each
 * row can count its frags as the replay plays, the way the game's own panel
 * does, and every vehicle's track, so each row can show its hit points left
 * and, for the recorder's opponents, whether they were in sight. Shared
 * through context rather than threaded through both columns.
 */
export const RosterContext = createContext<{
  region: Region;
  frags: { at: number; by: number }[];
  tracks: Map<number, Track>;
  /** Read the battle as this account's. */
  focus: (account: number) => void;
  /** The tick the countdown ends, before which nobody is hidden. */
  startsAt: number;
  /** The team of whoever recorded the replay: sight is theirs, so only the
   * other team can be in it or out of it. */
  recorderTeam: number | null;
  /** Their vehicle, the one row whose own spotting the replay knows. */
  recorderVehicle: number | null;
  /** When they were spotted, in ticks. */
  observed: number[];
} | null>(null);

/** How long the sixth sense stays lit, in seconds: the client's
 * `GUI_SETTINGS.sixthSenseDuration`. */
const SIXTH_SENSE_S = 2;

/**
 * One team, listed as the game's own panel lists it.
 *
 * Allies above the chat on the left, enemies above the timeline on the right,
 * which is the arrangement the client itself uses: `AllySortedIDsComposer`
 * fills `leftItemsIDs` and the enemy one fills `rightItemsIDs`.
 *
 * The order is the client's `VehicleInfoSortKey`: the living before the dead,
 * then tier DESCENDING, then class, then the vehicle's name, then the player's.
 * Sorted every frame rather than once, because the first of those keys is
 * exactly what the clock changes, and a roster whose wrecks sink to the bottom
 * as the battle goes is most of what this list is for.
 */
export function Roster({
  side,
  diedAt,
  highlightAccount,
  ally,
  at,
  ticks,
}: {
  side: Participant[];
  diedAt: Map<number, number>;
  highlightAccount?: number;
  ally: boolean;
  at: number;
  ticks: number;
}) {
  const now = at * ticks;
  const shared = useContext(RosterContext);
  const { t } = useTranslation("components/players/detail/overview/battles");
  // Frags so far: the kills whose tick the clock has reached.
  const fragsOf = (id: number) =>
    shared?.frags.filter((frag) => frag.by === id && frag.at <= now).length ?? 0;
  const rows = useMemo(() => {
    const dead = (one: Participant) => {
      const when = diedAt.get(one.id);
      return when !== undefined && now >= when;
    };
    return [...side].sort(
      (a, b) =>
        Number(dead(a)) - Number(dead(b)) ||
        (b.tank?.tier ?? 0) - (a.tank?.tier ?? 0) ||
        classRank(a.tank?.type ?? null) - classRank(b.tank?.type ?? null) ||
        (a.tank?.shortName ?? "").localeCompare(b.tank?.shortName ?? "") ||
        (a.player?.nickname ?? "").localeCompare(b.player?.nickname ?? ""),
    );
  }, [side, diedAt, now]);

  if (rows.length === 0) return null;
  return (
    // Hairlines between the rows rather than more air: fourteen names in a
    // column need a edge to scan down, and spacing alone made them one block.
    <ul className="border-border/50 divide-border/30 flex flex-col divide-y border-b text-xs">
      {rows.map((one) => {
        const when = diedAt.get(one.id);
        const dead = when !== undefined && now >= when;
        const mine =
          one.account !== undefined && one.account === highlightAccount;
        // Hit points left, as a bar behind the row the way the game's own
        // panel shows them. Full for a vehicle the recording never saw, like
        // the strip above the map: unseen is not damaged.
        const track = shared?.tracks.get(one.id);
        const share = dead ? 0 : track ? (healthAt(track, at, ticks) ?? 1) : 1;
        // In the recorder's sight or not, for their opponents alone: an ally is
        // always on their minimap, and nobody is told when an ally is seen.
        // Nothing at all until the vehicle has been seen once, which is the
        // game's own state before first contact.
        const watched =
          !dead && shared && shared.recorderTeam !== null && one.team !== shared.recorderTeam;
        const seen =
          watched && track ? pointAt(pathOf(track), at, ticks, shared.startsAt) : null;
        // The recorder's own sixth sense: lit for two seconds each time the
        // server said they were spotted, dimmed once it has been lit at least
        // once, empty before. Nobody else's is in the recording.
        const lamp =
          !dead && shared && one.id === shared.recorderVehicle
            ? shared.observed.some((when) => when <= now && now - when < SIXTH_SENSE_S * ticks)
              ? "lit"
              : shared.observed.some((when) => when <= now)
                ? "out"
                : null
            : null;
        return (
          <li key={one.id}>
          <button
            type="button"
            aria-pressed={mine}
            disabled={one.account === undefined}
            onClick={() => one.account !== undefined && shared?.focus(one.account)}
            className={cn(
              "w-full cursor-pointer text-start enabled:hover:bg-white/5 disabled:cursor-default",
              // In the game's own order, so every column lines up down the
              // list: the player, the vehicle's name, its class, the frags,
              // and the silhouette against the map. The enemy panel is the
              // mirror of the allied one, as the game draws its two ears.
              "relative isolate flex min-w-0 items-center gap-2 px-3 py-1",
              !ally && "flex-row-reverse",
              // Dimmed rather than struck through or greyed: the side is still
              // worth reading off a wreck, and it is the one thing a flat grey
              // would take away.
              dead && "opacity-40",
              // The reader's own row, lifted out of the list the way the game
              // lifts it: they look for themselves first.
              mine && "bg-amber-300/5",
            )}
          >
            {/* Drains towards the map, from the outer edge of either panel,
                so the two columns mirror each other like the rest of the row. */}
            <span
              aria-hidden
              style={{ width: `${share * 100}%` }}
              className={cn(
                "pointer-events-none absolute inset-y-0 -z-10 transition-[width] duration-300",
                ally ? "left-0" : "right-0",
                mine ? "bg-amber-300/10" : ally ? "bg-emerald-400/10" : "bg-red-400/10",
              )}
            />
            <span
              className={cn(
                "min-w-0 flex-1 truncate font-medium",
                !ally && "text-end",
                mine
                  ? "text-amber-300"
                  : ally
                    ? "text-emerald-400"
                    : "text-red-400",
              )}
            >
              {one.player?.nickname ?? "?"}
              {/* The clan in the game's own brackets, dimmed against the name:
                  it is how a player is recognised, not a second name. */}
              {one.player?.clanTag ? (
                <span className="opacity-60">{`[${one.player.clanTag}]`}</span>
              ) : null}
            </span>
            <span
              className={cn(
                "text-muted-foreground w-24 shrink-0 truncate",
                ally ? "text-end" : "text-start",
              )}
            >
              {one.tank?.shortName ?? ""}
            </span>
            <span className="flex w-3.5 shrink-0 justify-center">
              {one.tank?.type ? (
                <VehicleTypeIcon
                  type={one.tank.type}
                  size={12}
                  className={
                    mine
                      ? "text-amber-300"
                      : ally
                        ? "text-emerald-400"
                        : "text-red-400"
                  }
                />
              ) : null}
            </span>
            {/* Spotted, a fixed slot like the others: lit while in sight,
                struck through once lost, empty before first contact. */}
            <span className="flex w-3.5 shrink-0 justify-center">
              {lamp ? (
                <LightbulbFilamentIcon
                  size={12}
                  weight={lamp === "lit" ? "fill" : "regular"}
                  aria-label={t("replay.observed")}
                  className={lamp === "lit" ? "text-amber-300" : "text-muted-foreground"}
                />
              ) : seen ? (
                seen.spotted ? (
                  <EyeIcon
                    size={12}
                    weight="fill"
                    aria-label={t("replay.spotted")}
                    className="text-foreground"
                  />
                ) : (
                  <EyeSlashIcon
                    size={12}
                    aria-label={t("replay.unspotted")}
                    className="text-muted-foreground"
                  />
                )
              ) : null}
            </span>
            {/* Frags so far, a fixed slot so the columns stay aligned. */}
            <span className="w-4 shrink-0 text-center font-semibold tabular-nums">
              {fragsOf(one.id) || ""}
            </span>
            {/* Every silhouette starts at the same edge and its gun runs
                towards the map, as the game lines them up: centred or pushed
                to the far edge, hulls of different lengths left a ragged
                column. */}
            <span className={cn("flex w-11 shrink-0", ally ? "justify-start" : "justify-end")}>
              {one.tank && shared ? (
                <TankIcon
                  region={shared.region}
                  tag={one.tank.tag}
                  type={one.tank.type}
                  nation={one.tank.nation}
                  // Facing the map from either side, as the game draws them.
                  className={cn("h-4 w-auto object-contain", !ally && "-scale-x-100")}
                />
              ) : null}
            </span>
          </button>
          </li>
        );
      })}
    </ul>
  );
}
