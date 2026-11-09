"use client";

import { PlayerName } from "@/components/entity/player-name";
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
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import type { ManeuversPlayerRow } from "@/services/maneuvers/leaderboard";
import type { Region } from "@unicum.gg/wargaming";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

export function ManeuversPlayersTable({
  region,
  rows,
  cutoffPlace,
}: {
  region: Region;
  rows: ManeuversPlayerRow[];
  /** Last place rewarded with a vehicle, so a row can say which side of it it
   * is on. Null when the edition publishes no such cutoff. */
  cutoffPlace: number | null;
}) {
  const { t } = useTranslation("components/maneuvers/players-table");
  const { num } = useFormat();
  const { paged, pager } = usePagination(rows);

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">{t("place")}</TableHead>
            <TableHead>{t("player")}</TableHead>
            <TableHead className="text-right">{t("fame-points")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map((row) => (
            <TableRow
              key={row.accountId}
              // A rewarded place is the only distinction the board itself
              // makes, so it is the only one drawn.
              className={cn(
                cutoffPlace != null &&
                  row.place > cutoffPlace &&
                  "text-muted-foreground",
              )}
            >
              <TableCell className="tabular-nums">
                {/* The medal is the podium's own mark and only exists for the
                    three places that have one; everybody else gets their
                    number. */}
                {row.place <= 3 ? (
                  <RankMedal rank={row.place as 1 | 2 | 3} />
                ) : (
                  num(INT_FORMAT).format(row.place)
                )}
              </TableCell>
              <TableCell>
                <PlayerName
                  region={region}
                  player={{
                    nickname: row.nickname ?? String(row.accountId),
                    accountId: row.accountId,
                    clanTag: row.clanTag,
                  }}
                />
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {num(INT_FORMAT).format(row.famePoints)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePager pager={pager} />
    </div>
  );
}
