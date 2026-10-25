"use client";

import { Fragment, useState } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import {
  RATING_COLOR_CLASS,
  RATING_METRIC_LABEL,
  RatingMetric,
  type WnRatingMetric,
  wn7Color,
  wn8Color,
  wnxColor,
} from "@unicum.gg/shared";
import { PlayerName } from "@/components/entity/player-name";
import {
  CrewGroup,
  LoadoutShellBox,
  LoadoutSlotBox,
  LoadoutTooltips,
  type LoadoutSlotView,
} from "@/components/players/detail/tanks/loadout-boxes";
import { RankMedal } from "@/components/rank-medal";
import ROUTES from "@/constants/routes";
import { useRatingMetric } from "@/hooks/use-rating-metric";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFormat } from "@/hooks/use-format";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import type { TopPlayerRow } from "./view";

/**
 * The best players in this vehicle among those whose battles we hold, and what
 * each of them fits to it.
 *
 * Drawn as the Performances tab's top players board, row for row (the medal,
 * the name with its clan and crests, the muted record, the painted rating on
 * the metric picked in the navbar), with the loadout of each player's latest
 * recorded battle between the name and the figures, in the garage panel's own
 * boxes. Ranked on the metric picked, so the board and the navbar agree.
 *
 * The crew does not fit in a row (four or five seats of five to eight skills
 * each), so a row opens on it, drawn by the garage panel's own crew group: one
 * line per seat, its badge, then its skills in the order they were learned.
 */

const INT = { maximumFractionDigits: 0 } as const;
const PCT = { style: "percent", maximumFractionDigits: 1 } as const;

/** How many players the board shows. */
const SHOWN = 10;

/** The box edge: the largest that sits inside the board's 44px row. */
const BOX = 28;

const RATING_COLOR: Record<WnRatingMetric, (value: number) => string> = {
  [RatingMetric.Wn7]: (value) => RATING_COLOR_CLASS[wn7Color(value)],
  [RatingMetric.Wn8]: (value) => RATING_COLOR_CLASS[wn8Color(value)],
  [RatingMetric.Wnx]: (value) => RATING_COLOR_CLASS[wnxColor(value)],
};

export function TopPlayers({
  slug,
  rows,
  labels,
}: {
  /** The vehicle's slug: a name leads to that player's page on it. */
  slug: string;
  rows: TopPlayerRow[];
  labels: Record<
    "player" | "build" | "battles" | "damage" | "winrate" | "crew" | "showCrew",
    string
  >;
}) {
  const { num } = useFormat();
  // One open at a time, like the battle cards: two open crews is a wall.
  const [open, setOpen] = useState<string | null>(null);
  // A vehicle has no PR or WTR, so a reader on either reads the WN fallback.
  const { wnMetric: metric } = useRatingMetric();
  const ranked = rows
    .filter((row) => row.rating[metric] != null)
    .sort((a, b) => b.rating[metric]! - a.rating[metric]!)
    .slice(0, SHOWN);
  if (ranked.length === 0) return null;

  return (
    <LoadoutTooltips>
      <Table rail className="mb-px! [&_tr]:h-11">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 whitespace-nowrap px-4! text-center!">#</TableHead>
            <TableHead>{labels.player}</TableHead>
            <TableHead>{labels.build}</TableHead>
            <TableHead className={cn("w-24 text-right!", styles.hiddenColumn)}>
              {labels.battles}
            </TableHead>
            <TableHead className="hidden w-24 text-right! md:table-cell">
              {labels.damage}
            </TableHead>
            <TableHead className="hidden w-20 text-right! md:table-cell">
              {labels.winrate}
            </TableHead>
            <TableHead className="w-24 text-right!">
              {RATING_METRIC_LABEL[metric]}
            </TableHead>
            <TableHead className="w-10 pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranked.map((row, index) => {
            const rank = index + 1;
            const value = row.rating[metric]!;
            const key = row.identity.nickname;
            const expanded = open === key;
            const toggle = () => setOpen(expanded ? null : key);
            return (
              <Fragment key={key}>
              <TableRow
                // The whole row opens the crew, as a battle card opens its
                // report; the name inside stays a link to the profile.
                onClick={row.crew.length ? toggle : undefined}
                className={cn(row.crew.length && "cursor-pointer")}
              >
                <TableCell className="px-2! text-center font-mono tabular-nums text-muted-foreground">
                  {rank === 1 || rank === 2 || rank === 3 ? (
                    <RankMedal rank={rank} className="mx-auto" />
                  ) : (
                    rank
                  )}
                </TableCell>
                <TableCell className="min-w-0 whitespace-nowrap">
                  {/* To this player's page ON THIS VEHICLE rather than their
                      profile: the reader is on the vehicle's page, and how
                      this player drives it is what they came for. */}
                  <PlayerName
                    region={row.region}
                    player={row.identity}
                    href={ROUTES.PLAYER_TANK(row.region, row.identity.nickname, slug)}
                  />
                </TableCell>
                <TableCell className="py-1.5">
                  {/* The groups in the order the garage lays them out, each
                      kept together and spaced from the next, so they read as
                      sets rather than one run of pictures. A group the player
                      left empty is not drawn. */}
                  <span className="flex items-center gap-3">
                    <Boxes items={row.equipment} />
                    <Boxes items={row.directives} />
                    <Boxes items={row.consumables} />
                    {row.shells.length > 0 ? (
                      <span className="flex items-center gap-1.5">
                        {row.shells.map((shell, at) => (
                          <LoadoutShellBox key={at} shell={shell} size={BOX} />
                        ))}
                      </span>
                    ) : null}
                    <Boxes items={row.fieldMods} />
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums text-muted-foreground",
                    styles.hiddenColumn,
                  )}
                >
                  {num(INT).format(row.battles)}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                  {row.avgDamage == null ? "—" : num(INT).format(row.avgDamage)}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                  {row.winrate == null ? "—" : num(PCT).format(row.winrate)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold tabular-nums",
                    RATING_COLOR[metric](value),
                  )}
                >
                  {num(INT).format(value)}
                </TableCell>
                <TableCell className="pr-4">
                  {row.crew.length ? (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-label={labels.showCrew}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggle();
                      }}
                      className="flex cursor-pointer items-center justify-center text-muted-foreground"
                    >
                      <CaretDownIcon
                        className={cn("size-4 transition-transform", expanded && "rotate-180")}
                      />
                    </button>
                  ) : null}
                </TableCell>
              </TableRow>
              {expanded ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="px-4! py-3">
                    <CrewGroup label={labels.crew} crew={row.crew} />
                  </TableCell>
                </TableRow>
              ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </LoadoutTooltips>
  );
}

function Boxes({ items }: { items: LoadoutSlotView[] }) {
  if (items.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {items.map((item, at) => (
        <LoadoutSlotBox key={at} slot={item} size={BOX} />
      ))}
    </span>
  );
}
