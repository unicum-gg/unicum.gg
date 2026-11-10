"use client";

import { PlayerName } from "@/components/entity/player-name";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { RankMedal } from "@/components/rank-medal";
import {
  type ManeuversData,
  useManeuversEdition,
} from "@/components/maneuvers/edition-context";
import { maneuversEditionName } from "@/components/maneuvers/edition-name";
import { ManeuversEditionSelect } from "@/components/maneuvers/edition-select";
import { FamePoints, FamePointsCell } from "@/components/maneuvers/fame-points";
import {
  GainCell,
  ManeuversSortKey,
  MoveCell,
  useManeuversSort,
} from "@/components/maneuvers/columns";
import { SortableHead } from "@/components/tanks/sortable-head";
import { TablePager, usePagination } from "@/components/table-pager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PAGINATION from "@/constants/pagination";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";

type PlayerRow = ManeuversData["players"][number];

/**
 * The player half of a Maneuvers edition, in the site's own board chrome: a
 * bordered `Panel` and the ranked table with medals, coloured clan tags and
 * the players' crests, plus what each moved over the last day.
 *
 * Client, like every other board: the table paginates in the browser and the
 * figures read through `useFormat`, so the numbers wear the reader's locale.
 */
export function ManeuversPlayersBoard() {
  const { t } = useTranslation("components/players/list/maneuvers/view");
  const { date } = useFormat();
  const { t: tEdition } = useTranslation("components/maneuvers/edition-name");
  const { region, board, requested, loading } = useManeuversEdition();
  const { edition, players } = board;
  const { t: tCols } = useTranslation("components/maneuvers/columns");
  const { sorted, state: sort, toggle } = useManeuversSort(players);
  const { paged, pager } = usePagination(sorted, PAGINATION.SIZE.LEADERBOARD);
  // Absent rather than a column of dashes until the captures reach back a day.
  const measured = players.some((r) => r.gain24h != null);

  const cutoff = edition?.tankRewardPositions ?? null;

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <PanelTitle>{t("board", { count: players.length })}</PanelTitle>
        <ManeuversEditionSelect />
      </PanelHeader>
      <PanelContent className={cn("p-0", loading && "opacity-60")}>
        {/* An edition we hold nothing for: nothing ever recorded on this
            server, or a past one nobody captured while it ran (the source
            keeps no history). Said plainly rather than drawn as an empty
            board, which reads as one everybody lost. */}
        {!edition ? (
          <div className="min-h-32 px-4 py-12 text-center text-sm text-muted-foreground">
            {loading
              ? null
              : requested
                ? t("not-recorded", {
                    edition: maneuversEditionName(requested, tEdition),
                  })
                : t("no-edition")}
          </div>
        ) : (
          <>
            {players.length === 0 ? (
              <div className="text-muted-foreground px-4 py-12 text-center text-sm">
                {edition.startDate
                  ? t("not-started", { date: date("d MMMM yyyy").format(edition.startDate) })
                  : t("not-started-undated")}
              </div>
            ) : (
              <>
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
                      <TableHead className="w-16 text-center!">{t("place")}</TableHead>
                      <TableHead>{t("player")}</TableHead>
                      <SortableHead
                        col={ManeuversSortKey.FamePoints}
                        state={sort}
                        onToggle={toggle}
                        align="end"
                        headClassName="w-48"
                      >
                        {t("fame-points")}
                      </SortableHead>
                      {measured ? (
                        <>
                          <SortableHead
                            col={ManeuversSortKey.Gain}
                            state={sort}
                            onToggle={toggle}
                            align="end"
                            headClassName="w-24"
                            tooltip={tCols("gain-hint")}
                          >
                            {tCols("gain")}
                          </SortableHead>
                          <SortableHead
                            col={ManeuversSortKey.Move}
                            state={sort}
                            onToggle={toggle}
                            align="end"
                            headClassName="w-24"
                            tooltip={tCols("move-hint")}
                          >
                            {tCols("move")}
                          </SortableHead>
                        </>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((row) => (
                      <PlayerRowView
                        key={row.accountId}
                        region={region}
                        row={row}
                        cutoffPlace={cutoff}
                        ranked={board.standing?.playerCount ?? 0}
                        measured={measured}
                      />
                    ))}
                  </TableBody>
                </Table>
                {pager.total > 0 && <TablePager pager={pager} />}
              </>
            )}
          </>
        )}
      </PanelContent>
    </Panel>
  );
}

/** One standings row: medal or place, the player with their crests and coloured
 * tag, then the Fame Points it ranks on. */
function PlayerRowView({
  region,
  row,
  cutoffPlace,
  ranked,
  measured,
}: {
  region: Region;
  row: PlayerRow;
  cutoffPlace: number | null;
  ranked: number;
  measured: boolean;
}) {
  return (
    <TableRow
      className={cn(
        cutoffPlace != null && row.place > cutoffPlace && "text-muted-foreground",
      )}
    >
      <TableCell className="text-muted-foreground text-center tabular-nums">
        {row.place <= 3 ? (
          <RankMedal rank={row.place as 1 | 2 | 3} className="mx-auto" />
        ) : (
          row.place
        )}
      </TableCell>
      <TableCell>
        <PlayerName
          region={region}
          player={{
            nickname: row.nickname ?? String(row.accountId),
            accountId: row.accountId,
            clanTag: row.clanTag,
            clanColor: row.clanColor,
            isVerified: row.isVerified,
            isSupporter: row.isSupporter,
            twitchLogin: row.twitchLogin,
            tournamentWins: row.tournamentWins,
            tournamentFeaturedWins: row.tournamentFeaturedWins,
            tournamentBestTitle: row.tournamentBestTitle,
            onslaughtBestTier: row.onslaughtBestTier,
            onslaughtBestRank: row.onslaughtBestRank,
            onslaughtSeasons: row.onslaughtSeasons,
          }}
        />
      </TableCell>
      <FamePointsCell place={row.place} ranked={ranked}>
        <FamePoints value={row.famePoints} />
      </FamePointsCell>
      {measured ? (
        <>
          <GainCell value={row.gain24h} />
          <MoveCell value={row.placeChange24h} measured />
        </>
      ) : null}
    </TableRow>
  );
}
