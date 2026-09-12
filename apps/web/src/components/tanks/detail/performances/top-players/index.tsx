"use client";

import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { GlossaryLabel } from "@/components/glossary/label";
import { PlayerName } from "@/components/entity/player-name";
import { identityFromRow } from "@/components/entity/player-identity";
import { RankMedal } from "@/components/rank-medal";
import { RatingMetric, RATING_COLOR_CLASS, wn7Color, wn8Color, wnxColor } from "@unicum.gg/shared";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Region } from "@unicum.gg/wargaming";

const COLOR_FOR_METRIC: Record<RatingMetric, (v: number) => string> = {
  [RatingMetric.Wn7]: (v) => RATING_COLOR_CLASS[wn7Color(v)],
  [RatingMetric.Wn8]: (v) => RATING_COLOR_CLASS[wn8Color(v)],
  [RatingMetric.Wnx]: (v) => RATING_COLOR_CLASS[wnxColor(v)],
};

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const PCT_FORMAT = {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
} as const;

export function TankTopPlayers(
  props:
    | { loading: true }
    | {
        players: TopTankPlayer[];
        metric: RatingMetric;
        metricLabel: string;
        region: Region;
      },
) {
  const { t } = useTranslation("components/tanks/detail/performances/top-players/index");
  if ("loading" in props) return <TopPlayersSkeleton />;
  const { players, metric, metricLabel, region } = props;
  if (players.length === 0) {
    return (
      <div className="border-t border-fd-border p-6 text-center text-sm text-fd-muted-foreground">
        {t("no-ranked-players-on-this")}</div>
    );
  }
  return (
    <Table className="mb-px! [&_tr]:h-11">
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 whitespace-nowrap px-4! text-center!">
            #
          </TableHead>
          <TableHead>{t("player")}</TableHead>
          <TableHead className="hidden w-24 text-right! sm:table-cell">
            <GlossaryLabel>{t("battles")}</GlossaryLabel>
          </TableHead>
          <TableHead className="hidden w-24 text-right! md:table-cell">
            <GlossaryLabel>{t("avg-dmg")}</GlossaryLabel>
          </TableHead>
          <TableHead className="hidden w-20 text-right! md:table-cell">
            <GlossaryLabel>{t("wr")}</GlossaryLabel>
          </TableHead>
          <TableHead className="w-24 pr-4 text-right!">
            <GlossaryLabel label={metricLabel}>{metricLabel}</GlossaryLabel>
          </TableHead>
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
  const { num } = useFormat();
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
        <PlayerName region={region} player={identityFromRow(player)} />
      </TableCell>
      <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
        {num(INT_FORMAT).format(player.battles)}
      </TableCell>
      <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
        {num(INT_FORMAT).format(player.avg_damage)}
      </TableCell>
      <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
        {num(PCT_FORMAT).format(player.winrate)}%
      </TableCell>
      <TableCell
        className={cn("pr-4 text-right font-semibold tabular-nums", colorClass)}
      >
        {num(INT_FORMAT).format(player.value)}
      </TableCell>
    </TableRow>
  );
}

/** The loading twin: the same h-11 table with the real headers and 10
 * placeholder rows, mirroring the responsive column visibility. */
function TopPlayersSkeleton() {
  const { t } = useTranslation("components/tanks/detail/performances/top-players/index");
  return (
    <Table className="mb-px! [&_tr]:h-11">
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 whitespace-nowrap px-4! text-center!">
            #
          </TableHead>
          <TableHead>{t("player")}</TableHead>
          <TableHead className="hidden w-24 text-right! sm:table-cell">
            {t("battles")}</TableHead>
          <TableHead className="hidden w-24 text-right! md:table-cell">
            {t("avg-dmg")}</TableHead>
          <TableHead className="hidden w-20 text-right! md:table-cell">
            {t("wr")}</TableHead>
          <TableHead className="w-24 pr-4 text-right!">{t("rating")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 25 }, (_, i) => (
          <TableRow key={i}>
            <TableCell className="px-2! text-center">
              <Skeleton className="mx-auto h-4 w-4" />
            </TableCell>
            <TableCell className="min-w-0">
              <Skeleton className="h-4 w-40 max-w-full" />
            </TableCell>
            <TableCell className="hidden text-right sm:table-cell">
              <Skeleton className="ml-auto h-4 w-12" />
            </TableCell>
            <TableCell className="hidden text-right md:table-cell">
              <Skeleton className="ml-auto h-4 w-12" />
            </TableCell>
            <TableCell className="hidden text-right md:table-cell">
              <Skeleton className="ml-auto h-4 w-10" />
            </TableCell>
            <TableCell className="pr-4 text-right">
              <Skeleton className="ml-auto h-4 w-12" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
