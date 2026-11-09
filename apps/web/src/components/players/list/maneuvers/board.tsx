"use client";

import { PlayerName } from "@/components/entity/player-name";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { RankMedal } from "@/components/rank-medal";
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
import type { unicum } from "@/services/sdk";
import type { Region } from "@unicum.gg/wargaming";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const INSTANT = "d MMM, HH:mm";

// The board as the SDK hands it over, dates revived. Deriving the row shape from
// the client means a field added to the endpoint (a new crest, say) reaches the
// row here without a second type to keep in step.
type ManeuversData = Awaited<
  ReturnType<ReturnType<typeof unicum.region>["maneuvers"]>
>;
type PlayerRow = ManeuversData["players"][number];

/**
 * The player half of a Maneuvers edition, in the site's own board chrome: a
 * bordered `Panel`, the two figures that frame what a vehicle place costs, and
 * the ranked table with medals, coloured clan tags and the players' crests.
 *
 * Client, like every other board: the table paginates in the browser and the
 * figures read through `useFormat`, so the numbers wear the reader's locale.
 */
export function ManeuversPlayersBoard({
  region,
  board,
}: {
  region: Region;
  board: ManeuversData;
}) {
  const { t } = useTranslation("components/players/list/maneuvers/view");
  const { num, date } = useFormat();
  const { edition, standing, players } = board;
  const { paged, pager } = usePagination(players, PAGINATION.SIZE.LEADERBOARD);

  // Nothing has ever been recorded for this region. Said plainly rather than
  // drawn as an empty board, which reads as one everybody lost.
  if (!edition) {
    return (
      <Panel>
        <PanelContent className="px-4 py-12 text-center text-sm text-muted-foreground">
          {t("no-edition")}
        </PanelContent>
      </Panel>
    );
  }

  const cutoff = edition.tankRewardPositions;

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <PanelTitle>{t("board", { count: players.length })}</PanelTitle>
        {standing ? (
          <span className="text-fd-muted-foreground text-xs">
            {t("recomputed", { at: date(INSTANT).format(standing.capturedAt) })}
          </span>
        ) : null}
      </PanelHeader>
      <PanelContent className="p-0">
        {/* The two figures that frame the board, in the same bordered strip the
            other boards put their filter bar in. */}
        <dl className="grid grid-cols-2 gap-4 border-b border-fd-border px-4 py-3">
          <Figure
            label={t("tank-cutoff")}
            hint={t("tank-cutoff-hint", {
              places: num(INT_FORMAT).format(edition.tankRewardPositions ?? 0),
            })}
            value={
              standing?.tankCutoffPoints == null
                ? null
                : num(INT_FORMAT).format(standing.tankCutoffPoints)
            }
          />
          <Figure
            label={t("ranked-players")}
            value={standing ? num(INT_FORMAT).format(standing.playerCount) : null}
          />
        </dl>

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
                  <TableHead className="w-40 text-right!">
                    {t("fame-points")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((row) => (
                  <PlayerRowView
                    key={row.accountId}
                    region={region}
                    row={row}
                    cutoffPlace={cutoff}
                  />
                ))}
              </TableBody>
            </Table>
            {pager.total > 0 && <TablePager pager={pager} />}
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
}: {
  region: Region;
  row: PlayerRow;
  cutoffPlace: number | null;
}) {
  const { num } = useFormat();
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
      <TableCell className="text-right font-semibold tabular-nums">
        {num({ maximumFractionDigits: 0 }).format(row.famePoints)}
      </TableCell>
    </TableRow>
  );
}

/** One headline figure, with a dash where the board cannot answer yet. */
function Figure({
  label,
  hint,
  value,
}: {
  label: string;
  hint?: string;
  value: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs" title={hint}>
        {label}
      </dt>
      <dd className="text-xl font-semibold tabular-nums">{value ?? "—"}</dd>
    </div>
  );
}
