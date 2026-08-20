import Link from "next/link";
import { ClanTag } from "@/components/entity/clan-tag";
import { GlossaryLabel } from "@/components/glossary/label";
import { PlayerBadges } from "@/components/entity/badges/player-badges";
import { LanguageFlags } from "@/components/language-flags";
import { RankMedal } from "@/components/rank-medal";
import { RATING_METRIC_LABEL, RatingMetric, RATING_COLOR_CLASS, winrateColor, wn7Color, wn8Color, wnxColor } from "@unicum.gg/shared";
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
import type { Region } from "@unicum.gg/wargaming";
import type { TopPlayerByLanguageResult } from "@/services/wargaming/wot/players/top/by-language";

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

export function TopPlayersList({
  region,
  results,
  metric,
  rankOffset = 0,
}: {
  region: Region;
  results: TopPlayerByLanguageResult[];
  metric: RatingMetric;
  // Global rank of the first row (the page offset), so paginated pages keep the
  // true leaderboard rank instead of restarting at 1.
  rankOffset?: number;
}) {
  if (results.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
        No players match this filter yet.
      </div>
    );
  }
  const colorFor = COLOR_FOR_METRIC[metric];
  return (
    <Table
      className={cn(
        // Same compact padding model as /clans so /players reads as a
        // sibling page rather than its own design.
        "my-0! table-fixed",
        "[&_td]:min-w-0 [&_td]:py-2!",
        "[&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4!",
        "[&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!",
      )}
    >
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-center!">#</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="w-24 text-right! tabular-nums">
            <GlossaryLabel>Battles</GlossaryLabel>
          </TableHead>
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
            <TableRow key={r.account_id}>
              <TableCell className="text-center text-muted-foreground tabular-nums">
                {rank <= 3 ? (
                  <RankMedal rank={rank as 1 | 2 | 3} className="mx-auto" />
                ) : (
                  rank
                )}
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5">
                  {/* No `flex-1` on the link: it would eat the free width and
                      push the badges to the far edge of the cell, away from the
                      nickname they belong to. It shrinks (min-w-0 + truncate)
                      only when the name is too long. */}
                  <Link
                    href={ROUTES.PLAYER(region, r.nickname)}
                    className="flex min-w-0 items-center gap-3 hover:underline"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{r.nickname}</span>
                      {r.clan_tag ? (
                        <>
                          {" "}
                          <ClanTag
                            tag={r.clan_tag}
                            color={r.clan_color}
                            className="font-mono text-xs"
                          />
                        </>
                      ) : null}
                    </span>
                  </Link>
                  <PlayerBadges
                    region={region}
                    accountId={r.account_id}
                    verified={r.is_verified}
                    supporter={r.is_supporter}
                    twitchLogin={r.twitch_login}
                  />
                  {/* Lifted out of the link so the badges can sit next to the
                      nickname; `ml-auto` keeps the flags on the right edge. */}
                  {r.languages.length > 0 && (
                    <span className="ml-auto hidden h-4 shrink-0 sm:inline-flex">
                      <LanguageFlags
                        languages={r.languages}
                        source="inferred"
                        size="s"
                        region={region}
                        link={false}
                      />
                    </span>
                  )}
                </span>
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {intFmt.format(r.battles)}
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
                  colorFor(r.wnx),
                )}
              >
                {intFmt.format(r.wnx)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
