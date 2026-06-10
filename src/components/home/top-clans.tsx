"use client";

import Image from "next/image";
import Link from "next/link";
import { RankMedal } from "@/components/rank-medal";
import { RelativeTime } from "@/components/relative-time";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  RATING_METRIC_LABEL,
  RatingMetric,
} from "@/constants/rating";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import type { TopClanResult } from "@/services/wargaming/wot/clans/top";
import {
  RATING_COLOR_CLASS,
  wn7Color,
  wn8Color,
  wnxColor,
} from "@/services/wargaming/wot/ratings";

const COLOR_FOR_METRIC: Record<RatingMetric, (v: number) => string> = {
  [RatingMetric.Wn7]: (v) => RATING_COLOR_CLASS[wn7Color(v)],
  [RatingMetric.Wn8]: (v) => RATING_COLOR_CLASS[wn8Color(v)],
  [RatingMetric.Wnx]: (v) => RATING_COLOR_CLASS[wnxColor(v)],
};
import {
  isRegion,
  Region,
  REGION_EMOJI,
  REGION_LABEL,
} from "@/services/wargaming/wot";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export type TopClansInitial = Record<
  Region,
  { results: TopClanResult[]; computedAt: Date | null }
>;

export function TopClans({
  initial,
  regionOverride,
}: {
  initial: TopClansInitial;
  regionOverride?: Region;
}) {
  const [storedRegion] = useCookie(STORAGE.COOKIES.REGION, Region.EU);
  const [storedRating] = useCookie(
    STORAGE.COOKIES.RATING,
    DEFAULT_RATING_METRIC,
  );
  const region: Region =
    regionOverride ?? (isRegion(storedRegion) ? storedRegion : Region.EU);
  const metric: RatingMetric = isRatingMetric(storedRating)
    ? storedRating
    : DEFAULT_RATING_METRIC;
  const metricLabel = RATING_METRIC_LABEL[metric];
  const { results, computedAt } = initial[region];

  return (
    <div className="flex h-full flex-col">
      <div className={cn("p-4", styles.mutedDescription)}>
        Showing top {REGION_EMOJI[region]} {REGION_LABEL[region]} clans with
        more than 50 members, ranked by average <RatingMetricInlineSelect />.
        {computedAt ? (
          <>
            {" "}
            Updated <RelativeTime date={computedAt} />.
          </>
        ) : null}
      </div>
      {results.length === 0 ? (
        <div className="mt-auto border-t border-fd-border p-6 text-center text-sm text-fd-muted-foreground">
          No clan data available yet for this region.
        </div>
      ) : (
        <div className="mt-auto">
          <Table className="mb-px! table-fixed [&_tr]:h-11">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 whitespace-nowrap px-4! text-center!">
                  #
                </TableHead>
                <TableHead>Clan</TableHead>
                <TableHead className="w-24 pr-4 text-right!">
                  Avg {metricLabel}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((c, i) => (
                <ClanRow
                  key={c.clan_id}
                  clan={c}
                  rank={i + 1}
                  region={region}
                  metric={metric}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ClanRow({
  clan,
  rank,
  region,
  metric,
}: {
  clan: TopClanResult;
  rank: number;
  region: Region;
  metric: RatingMetric;
}) {
  const colorClass = COLOR_FOR_METRIC[metric](clan.avg_wnx);
  return (
    <TableRow>
      <TableCell className="px-4! text-center font-mono tabular-nums text-muted-foreground">
        {rank === 1 || rank === 2 || rank === 3 ? (
          <RankMedal rank={rank} />
        ) : (
          rank
        )}
      </TableCell>
      <TableCell>
        <Link
          href={ROUTES.CLAN(region, clan.tag)}
          className="flex items-center gap-3 hover:underline"
        >
          {clan.emblem ? (
            <Image
              src={clan.emblem}
              alt=""
              width={24}
              height={24}
              className="size-6 shrink-0 rounded"
            />
          ) : (
            <span className="size-6 shrink-0 rounded bg-muted" />
          )}
          <span className="min-w-0 flex-1 truncate">
            <span className="font-mono font-semibold">
              <span style={{ color: clan.color }}>[</span>
              {clan.tag}
              <span style={{ color: clan.color }}>]</span>
            </span>{" "}
            <span className="text-muted-foreground">{clan.name}</span>
          </span>
        </Link>
      </TableCell>
      <TableCell
        className={cn(
          "pr-4 text-right font-semibold tabular-nums",
          colorClass,
        )}
      >
        {intFmt.format(clan.avg_wnx)}
      </TableCell>
    </TableRow>
  );
}
