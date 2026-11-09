"use client";

import { ClanName } from "@/components/entity/clan-name";
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
import type { ClanRankBadge } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const INSTANT = "d MMM, HH:mm";

type ManeuversData = Awaited<
  ReturnType<ReturnType<typeof unicum.region>["maneuvers"]>
>;
type ClanRow = ManeuversData["clans"][number];

/**
 * The clan half of a Maneuvers edition, in the site's own board chrome: a
 * bordered `Panel`, the two figures that frame what a gold place costs, and the
 * ranked table with medals, emblems, coloured tags and the clans' placing
 * crests.
 */
export function ManeuversClansBoard({
  region,
  board,
}: {
  region: Region;
  board: ManeuversData;
}) {
  const { t } = useTranslation("components/clans/list/maneuvers/view");
  const { num, date } = useFormat();
  const { edition, standing, clans } = board;
  const { paged, pager } = usePagination(clans, PAGINATION.SIZE.LEADERBOARD);

  if (!edition) {
    return (
      <Panel>
        <PanelContent className="px-4 py-12 text-center text-sm text-muted-foreground">
          {t("no-edition")}
        </PanelContent>
      </Panel>
    );
  }

  const cutoff = edition.clanGoldPositions;

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <PanelTitle>{t("board", { count: clans.length })}</PanelTitle>
        {standing ? (
          <span className="text-fd-muted-foreground text-xs">
            {t("recomputed", { at: date(INSTANT).format(standing.capturedAt) })}
          </span>
        ) : null}
      </PanelHeader>
      <PanelContent className="p-0">
        <dl className="grid grid-cols-2 gap-4 border-b border-fd-border px-4 py-3">
          <Figure
            label={t("clan-cutoff")}
            hint={t("clan-cutoff-hint", {
              places: num(INT_FORMAT).format(edition.clanGoldPositions ?? 0),
            })}
            value={
              standing?.clanGoldCutoffPoints == null
                ? null
                : num(INT_FORMAT).format(standing.clanGoldCutoffPoints)
            }
          />
          <Figure
            label={t("ranked-clans")}
            value={standing ? num(INT_FORMAT).format(standing.clanCount) : null}
          />
        </dl>

        {clans.length === 0 ? (
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
                  <TableHead>{t("clan")}</TableHead>
                  <TableHead className="w-40 text-right!">
                    {t("fame-points")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((row) => (
                  <ClanRowView
                    key={row.clanId}
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

/** One standings row: medal or place, the clan with its emblem, coloured tag and
 * placing crests, then the Fame Points it ranks on. */
function ClanRowView({
  region,
  row,
  cutoffPlace,
}: {
  region: Region;
  row: ClanRow;
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
        <ClanName
          region={region}
          showEmblem
          showName
          clan={{
            // The board keyed the clan on its id; a tag it never read falls back
            // to that so the row still links.
            tag: row.tag ?? String(row.clanId),
            name: row.name,
            color: row.color,
            emblem: row.emblem,
            // The SDK types the board enum as its own string union; it is the
            // same value `ClanRankBadge` holds, so the cast only reconciles the
            // nominal enum, not the data.
            badges: row.badges as ClanRankBadge[] | undefined,
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
