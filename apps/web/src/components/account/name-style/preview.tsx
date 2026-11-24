"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  RATING_COLOR_CLASS,
  RATING_METRIC_LABEL,
  inferPlayerLanguages,
  ratingColorClass,
  winrateColor,
  type NameStyle,
  type PlayerDetailData,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { SupporterBadgeState } from "@/components/entity/badges/supporter-badge";
import { NameStylePreviewScope } from "@/components/entity/name-style";
import { PlayerName } from "@/components/entity/player-name";
import { PlayerHeader } from "@/components/players/detail/header";
import { RankMedal } from "@/components/rank-medal";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFormat } from "@/hooks/use-format";
import { useRatingMetric } from "@/hooks/use-rating-metric";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { unicum } from "@/services/sdk";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const PCT_FORMAT = {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

/**
 * The reader's own account, drawn by the site's own components with the draft
 * style on their nickname: their profile header exactly as it renders, and the
 * row they would hold on a leaderboard, with their clan, their crests and their
 * real figures. A mock-up of either would be a promise about how the style
 * looks; this is how it looks.
 *
 * Read from the same profile payload the player page uses, keyed the same way,
 * so a reader who came from their profile pays nothing, and only once the
 * dialog is open.
 */
export function NameStylePreview({
  region,
  nickname,
  style,
}: {
  region: Region;
  nickname: string;
  style: NameStyle;
}) {
  const { t } = useTranslation("components/account/name-style/preview");
  const { t: tList } = useTranslation("components/players/list/view");
  const { t: tRow } = useTranslation("components/players/list/top-players-list");
  const { num } = useFormat();
  const { wnMetric } = useRatingMetric();
  const [nowMs] = useState(() => Date.now());
  const req = () => unicum.region(region).players(nickname).detail();
  const { data, error } = useSWR(req().url(), () =>
    req().then((r) => r as unknown as PlayerDetailData),
  );

  if (error) {
    return <p className="text-sm text-fd-muted-foreground">{t("unavailable")}</p>;
  }
  if (!data) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const stint = data.clanHistory.currentStint;
  const rating = data.derived[wnMetric].total;
  const winrate =
    data.current.battles > 0 ? data.current.wins / data.current.battles : null;
  return (
    <NameStylePreviewScope nickname={data.player.nickname} style={style}>
      {/* To be looked at, not used: the header's buttons and the row's links
          would otherwise leave the dialog for the real pages. */}
      <div className="pointer-events-none flex min-w-0 flex-col gap-5 select-none">
        <section className="flex min-w-0 flex-col gap-2">
          <p className="text-xs font-medium text-fd-muted-foreground">
            {t("profile")}
          </p>
          {/* A plain frame rather than the site's Panel, whose rules run the
              width of the window and would cross the dialog. */}
          <div className="w-full min-w-0 overflow-hidden rounded-lg border border-fd-border">
              <PlayerHeader
                region={region}
                accountId={data.player.accountId}
                nickname={data.player.nickname}
                createdAt={data.player.createdAt}
                lastBattleAt={data.player.lastBattleAt}
                updatedAt={data.player.updatedAt}
                currentStint={stint}
                inferredLanguages={inferPlayerLanguages(data.clanHistory, nowMs)}
                supporterBadge={SupporterBadgeState.Active}
                verified={data.isVerified}
                tournamentWins={data.tournamentWins}
                tournamentFeaturedWins={data.tournamentFeaturedWins}
                tournamentBestTitle={data.tournamentBestTitle}
                onslaughtBestTier={data.onslaughtBestTier}
                onslaughtBestRank={data.onslaughtBestRank}
                onslaughtSeasons={data.onslaughtSeasons}
                twitchLogin={data.twitchLogin}
              />
          </div>
        </section>
        <section className="flex min-w-0 flex-col gap-2">
          <p className="text-xs font-medium text-fd-muted-foreground">
            {t("leaderboard")}
          </p>
          {/* A plain frame rather than the site's Panel, whose rules run the
              width of the window and would cross the dialog. */}
          <div className="w-full min-w-0 overflow-hidden rounded-lg border border-fd-border">
              <Table
                className={cn(
                  "my-0! table-fixed",
                  "[&_td]:min-w-0 [&_td]:py-2!",
                  "[&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4!",
                  "[&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!",
                )}
              >
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center!">#</TableHead>
                    <TableHead>{tList("columns.player")}</TableHead>
                    <TableHead className="w-20 text-right! tabular-nums">
                      {tList("battles")}
                    </TableHead>
                    <TableHead className="hidden w-20 text-right! sm:table-cell">
                      {tRow("wr")}
                    </TableHead>
                    <TableHead className="w-16 text-right!">
                      {RATING_METRIC_LABEL[wnMetric]}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-center">
                      <RankMedal rank={1} className="mx-auto" />
                    </TableCell>
                    <TableCell>
                      <PlayerName
                        region={region}
                        player={{
                          nickname: data.player.nickname,
                          accountId: data.player.accountId,
                          clanTag: stint?.clan.tag ?? null,
                          clanColor: stint?.clan.color ?? null,
                          isVerified: data.isVerified,
                          isSupporter: true,
                          twitchLogin: data.twitchLogin,
                          tournamentWins: data.tournamentWins,
                          tournamentFeaturedWins: data.tournamentFeaturedWins,
                          tournamentBestTitle: data.tournamentBestTitle,
                          onslaughtBestTier: data.onslaughtBestTier,
                          onslaughtBestRank: data.onslaughtBestRank,
                          onslaughtSeasons: data.onslaughtSeasons,
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {num(INT_FORMAT).format(data.current.battles)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "hidden text-right font-semibold tabular-nums sm:table-cell",
                        winrate != null && RATING_COLOR_CLASS[winrateColor(winrate)],
                      )}
                    >
                      {winrate != null ? num(PCT_FORMAT).format(winrate) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        rating != null && ratingColorClass(wnMetric, rating),
                      )}
                    >
                      {rating != null ? num(INT_FORMAT).format(rating) : "—"}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
          </div>
        </section>
        <p className="text-xs text-fd-muted-foreground">{t("note")}</p>
      </div>
    </NameStylePreviewScope>
  );
}
