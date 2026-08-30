"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { ClanTag } from "@/components/entity/clan-tag";
import { GlossaryLabel } from "@/components/glossary/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEFAULT_RATING_METRIC, isRatingMetric, RATING_METRIC_LABEL, RatingMetric, type ClanMemberStats, RATING_COLOR_CLASS, type RatingColor, wn7Color, wn8Color, wnxColor } from "@unicum.gg/shared";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";
import { dec2Fmt } from "@/components/compare/cells";
import { type ClanCompareSlot } from "./comparison-table";

const TOP_N = 10;

type Row = {
  rank: number;
  cells: ({
    member: ClanMemberStats;
    rating: number | null;
  } | null)[];
};

function pickRating(member: ClanMemberStats, metric: RatingMetric): number | null {
  if (metric === RatingMetric.Wn7) return member.wn730d ?? member.wn7;
  if (metric === RatingMetric.Wn8) return member.wn830d ?? member.wn8;
  return member.wnx30d ?? member.wnx;
}

export function TopMembersTab({
  region,
  slots,
}: {
  region: Region;
  slots: ClanCompareSlot[];
}) {
  const [storedRating] = useCookie(
    STORAGE.COOKIES.RATING,
    DEFAULT_RATING_METRIC,
  );
  const metric: RatingMetric = isRatingMetric(storedRating)
    ? storedRating
    : DEFAULT_RATING_METRIC;
  const metricLabel = RATING_METRIC_LABEL[metric];
  const ratingColor: (v: number) => RatingColor =
    metric === RatingMetric.Wn7
      ? wn7Color
      : metric === RatingMetric.Wn8
        ? wn8Color
        : wnxColor;

  const rows: Row[] = useMemo(() => {
    const slotTops = slots.map((s) => {
      const sorted = [...s.members]
        .map((m) => ({ member: m, rating: pickRating(m, metric) }))
        .filter((x) => x.rating !== null)
        .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
        .slice(0, TOP_N);
      return sorted;
    });

    const out: Row[] = [];
    for (let i = 0; i < TOP_N; i++) {
      out.push({
        rank: i + 1,
        cells: slotTops.map((top) => top[i] ?? null),
      });
    }
    return out;
  }, [slots, metric]);

  return (
    <div className="overflow-x-auto">
      <Table className="my-0! table-fixed [&_td]:py-1.5! [&_tbody_td:first-child]:pl-4! [&_thead_th:first-child]:pl-4! [&_tbody_tr]:border-b [&_tbody_tr]:border-fd-border [&_thead_tr]:border-b [&_thead_tr]:border-fd-border [&_td]:border-r [&_th]:border-r [&_td]:border-fd-border [&_th]:border-fd-border [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">#</TableHead>
            {slots.map((s, idx) => (
              <TableHead
                key={`${s.requested}-${idx}`}
                colSpan={2}
                className="text-center"
              >
                <ClanTag
                  tag={s.clan?.tag ?? s.requested}
                  color={s.clan?.color ?? null}
                  className="font-mono"
                />
              </TableHead>
            ))}
          </TableRow>
          <TableRow>
            <TableHead className="text-xs text-muted-foreground" />
            {slots.map((_, idx) => (
              <Fragment key={idx}>
                <TableHead className="text-xs text-muted-foreground">
                  Player
                </TableHead>
                <TableHead className="text-right text-xs text-muted-foreground">
                  <GlossaryLabel label={metricLabel}>{metricLabel}</GlossaryLabel>
                </TableHead>
              </Fragment>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.rank}>
              <TableCell className="text-center tabular-nums text-muted-foreground">
                {r.rank}
              </TableCell>
              {r.cells.map((cell, i) => (
                <Fragment key={i}>
                  <TableCell className="font-medium">
                    {cell ? (
                      <Link
                        href={ROUTES.PLAYER(region, cell.member.name)}
                        className="hover:underline"
                      >
                        {cell.member.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      cell?.rating != null
                        ? RATING_COLOR_CLASS[ratingColor(cell.rating)]
                        : "text-muted-foreground",
                    )}
                  >
                    {cell?.rating != null ? dec2Fmt.format(cell.rating) : "—"}
                  </TableCell>
                </Fragment>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
