import { GlossaryLabel } from "@/components/glossary/label";
import { ClanName } from "@/components/entity/clan-name";
import { clanIdentityFromRow } from "@/components/entity/clan-identity";
import { LanguageFlags } from "@/components/language-flags";
import { RankMedal } from "@/components/rank-medal";
import { ClanBoard, RatingMetric, RATING_METRIC_LABEL, RATING_COLOR_CLASS, winrateColor, wn7Color, wn8Color, wnxColor } from "@unicum.gg/shared";
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
const pctFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COLOR_FOR_METRIC: Record<RatingMetric, (v: number) => string> = {
  [RatingMetric.Wn7]: (v) => RATING_COLOR_CLASS[wn7Color(v)],
  [RatingMetric.Wn8]: (v) => RATING_COLOR_CLASS[wn8Color(v)],
  [RatingMetric.Wnx]: (v) => RATING_COLOR_CLASS[wnxColor(v)],
};

export function TopClansList({
  region,
  results,
  metric,
  omitBoard,
  rankOffset = 0,
}: {
  region: Region;
  results: TopClanByLanguageResult[];
  metric: RatingMetric;
  /** Board this table is itself ranking, whose badge is dropped from the rows:
   * on the global WNX board, a "#1 WNX" crest beside row 1 only repeats the
   * rank column. The other boards' crests still show, and on a language board
   * nothing is dropped because being first in English is not being first
   * overall. */
  omitBoard?: ClanBoard;
  // Global rank of the first row (the page offset), so paginated pages keep the
  // true leaderboard rank instead of restarting at 1.
  rankOffset?: number;
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
          <TableHead className="hidden w-24 text-right! tabular-nums sm:table-cell">
            <GlossaryLabel>WR</GlossaryLabel>
          </TableHead>
          <TableHead className="w-24 text-right!">
            <GlossaryLabel label={RATING_METRIC_LABEL[metric]}>
              {RATING_METRIC_LABEL[metric]}
            </GlossaryLabel>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((r, i) => {
          const rank = rankOffset + i + 1;
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
                <ClanName
                  region={region}
                  clan={clanIdentityFromRow(r)}
                  showEmblem
                  showName
                  omitBoard={omitBoard}
                  size={14}
                  // The name shrinks rather than stretching, so the crests stay
                  // beside it instead of at the cell's far edge.
                  trailing={
                    r.languages.length > 0 ? (
                      <span className="ml-auto hidden h-4 shrink-0 sm:inline-flex">
                        <LanguageFlags
                          languages={r.languages}
                          source="declared"
                          size="s"
                          region={region}
                          link={false}
                        />
                      </span>
                    ) : null
                  }
                />
              </TableCell>
              <TableCell className="text-center text-muted-foreground tabular-nums">
                {intFmt.format(r.members_count)}
              </TableCell>
              <TableCell
                className={cn(
                  "hidden text-right font-semibold tabular-nums sm:table-cell",
                  r.winrate != null && RATING_COLOR_CLASS[winrateColor(r.winrate)],
                )}
              >
                {r.winrate != null ? pctFmt.format(r.winrate) : "—"}
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
