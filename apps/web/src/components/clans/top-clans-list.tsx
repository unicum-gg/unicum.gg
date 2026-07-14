import Image from "next/image";
import Link from "next/link";
import { LanguageFlags } from "@/components/language-flags";
import { RankMedal } from "@/components/rank-medal";
import { RatingMetric, RATING_METRIC_LABEL, RATING_COLOR_CLASS, wn7Color, wn8Color, wnxColor } from "@unicum.gg/shared";
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
import type { TopClanByLanguageResult } from "@/services/wargaming/wot/clans/top/by-language";
import type { Region } from "@unicum.gg/wargaming";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const COLOR_FOR_METRIC: Record<RatingMetric, (v: number) => string> = {
  [RatingMetric.Wn7]: (v) => RATING_COLOR_CLASS[wn7Color(v)],
  [RatingMetric.Wn8]: (v) => RATING_COLOR_CLASS[wn8Color(v)],
  [RatingMetric.Wnx]: (v) => RATING_COLOR_CLASS[wnxColor(v)],
};

export function TopClansList({
  region,
  results,
  metric,
}: {
  region: Region;
  results: TopClanByLanguageResult[];
  metric: RatingMetric;
}) {
  if (results.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
        No clans match this filter yet.
      </div>
    );
  }
  const colorFor = COLOR_FOR_METRIC[metric];
  return (
    <Table
      className={cn(
        // Consolidated layout overrides: same compact padding model as the
        // clan members table so /clans rows feel native to the rest of the
        // site rather than spaced out at a different rhythm.
        "my-0! table-fixed",
        "[&_td]:min-w-0 [&_td]:py-2!",
        "[&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4!",
        "[&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!",
      )}
    >
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-center!">#</TableHead>
          <TableHead>Clan</TableHead>
          <TableHead className="w-24 text-center!">Members</TableHead>
          <TableHead className="w-24 text-right!">
            {RATING_METRIC_LABEL[metric]}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((r, i) => {
          const rank = i + 1;
          return (
            <TableRow key={r.clan_id}>
              <TableCell className="text-center text-muted-foreground tabular-nums">
                {rank <= 3 ? (
                  <RankMedal rank={rank as 1 | 2 | 3} className="mx-auto" />
                ) : (
                  rank
                )}
              </TableCell>
              <TableCell>
                <Link
                  href={ROUTES.CLAN(region, r.tag)}
                  prefetch={false}
                  className="flex items-center gap-3 hover:underline"
                >
                  {r.emblem ? (
                    <Image
                      src={r.emblem}
                      alt=""
                      width={24}
                      height={24}
                      className="size-6 shrink-0 rounded"
                    />
                  ) : (
                    <span className="size-6 shrink-0 rounded bg-muted" />
                  )}
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono font-semibold">
                        <span style={{ color: r.color }}>[</span>
                        {r.tag}
                        <span style={{ color: r.color }}>]</span>
                      </span>{" "}
                      <span className="text-muted-foreground">{r.name}</span>
                    </span>
                    {r.languages.length > 0 && (
                      <span className="hidden h-4 shrink-0 sm:inline-flex">
                        <LanguageFlags
                          languages={r.languages}
                          source="declared"
                          size="s"
                          region={region}
                          link={false}
                        />
                      </span>
                    )}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="text-center text-muted-foreground tabular-nums">
                {intFmt.format(r.members_count)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-semibold tabular-nums",
                  colorFor(r.avg_value),
                )}
              >
                {intFmt.format(r.avg_value)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
