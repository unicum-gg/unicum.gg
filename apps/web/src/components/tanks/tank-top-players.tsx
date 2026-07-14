"use client";

import Link from "next/link";
import { RankMedal } from "@/components/rank-medal";
import { RatingMetric } from "@unicum.gg/core/constants/rating";
import ROUTES from "@/constants/routes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { TopTankPlayer } from "@unicum.gg/core/wargaming/wot/players/top/by-tank";
import {
  RATING_COLOR_CLASS,
  wn7Color,
  wn8Color,
  wnxColor,
} from "@unicum.gg/core/wargaming/wot/ratings";
import { Region } from "@unicum.gg/wargaming";

const COLOR_FOR_METRIC: Record<RatingMetric, (v: number) => string> = {
  [RatingMetric.Wn7]: (v) => RATING_COLOR_CLASS[wn7Color(v)],
  [RatingMetric.Wn8]: (v) => RATING_COLOR_CLASS[wn8Color(v)],
  [RatingMetric.Wnx]: (v) => RATING_COLOR_CLASS[wnxColor(v)],
};

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function TankTopPlayers({
  players,
  metric,
  metricLabel,
  region,
}: {
  players: TopTankPlayer[];
  metric: RatingMetric;
  metricLabel: string;
  region: Region;
}) {
  if (players.length === 0) {
    return (
      <div className="border-t border-fd-border p-6 text-center text-sm text-fd-muted-foreground">
        No ranked players on this tank yet.
      </div>
    );
  }
  return (
    <Table className="mb-px! [&_tr]:h-11">
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 whitespace-nowrap px-4! text-center!">
            #
          </TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="hidden w-24 text-right! sm:table-cell">
            Battles
          </TableHead>
          <TableHead className="hidden w-24 text-right! md:table-cell">
            Avg dmg
          </TableHead>
          <TableHead className="hidden w-20 text-right! md:table-cell">
            WR
          </TableHead>
          <TableHead className="w-24 pr-4 text-right!">{metricLabel}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {players.map((p, i) => (
          <PlayerRow
            key={p.account_id}
            player={p}
            rank={i + 1}
            region={region}
            metric={metric}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function PlayerRow({
  player,
  rank,
  region,
  metric,
}: {
  player: TopTankPlayer;
  rank: number;
  region: Region;
  metric: RatingMetric;
}) {
  const colorClass = COLOR_FOR_METRIC[metric](player.value);
  return (
    <TableRow>
      <TableCell className="px-2! text-center font-mono tabular-nums text-muted-foreground">
        {rank === 1 || rank === 2 || rank === 3 ? (
          <RankMedal rank={rank} className="mx-auto" />
        ) : (
          rank
        )}
      </TableCell>
      <TableCell className="min-w-0">
        <Link
          href={ROUTES.PLAYER(region, player.nickname)}
          className="block truncate hover:underline"
        >
          <span className="font-medium">{player.nickname}</span>
          {player.clan_tag ? (
            <>
              {" "}
              <span className="font-mono text-xs">
                <span style={{ color: player.clan_color ?? undefined }}>[</span>
                {player.clan_tag}
                <span style={{ color: player.clan_color ?? undefined }}>]</span>
              </span>
            </>
          ) : null}
        </Link>
      </TableCell>
      <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
        {intFmt.format(player.battles)}
      </TableCell>
      <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
        {intFmt.format(player.avg_damage)}
      </TableCell>
      <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
        {pctFmt.format(player.winrate)}%
      </TableCell>
      <TableCell
        className={cn("pr-4 text-right font-semibold tabular-nums", colorClass)}
      >
        {intFmt.format(player.value)}
      </TableCell>
    </TableRow>
  );
}
