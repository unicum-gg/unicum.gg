"use client";

import { ClanName } from "@/components/entity/clan-name";
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
import type { ManeuversClanRow } from "@/services/maneuvers/leaderboard";
import type { Region } from "@unicum.gg/wargaming";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

export function ManeuversClansTable({
  region,
  rows,
  cutoffPlace,
}: {
  region: Region;
  rows: ManeuversClanRow[];
  /** Last place rewarded with gold for the clan treasury. */
  cutoffPlace: number | null;
}) {
  const { t } = useTranslation("components/maneuvers/clans-table");
  const { num } = useFormat();
  const { paged, pager } = usePagination(rows);

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">{t("place")}</TableHead>
            <TableHead>{t("clan")}</TableHead>
            <TableHead className="text-right">{t("fame-points")}</TableHead>
            <TableHead className="text-right">{t("victories")}</TableHead>
            <TableHead className="text-right">{t("defeats")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map((row) => (
            <TableRow
              key={row.clanId}
              className={cn(
                cutoffPlace != null &&
                  row.place > cutoffPlace &&
                  "text-muted-foreground",
              )}
            >
              <TableCell className="tabular-nums">
                {row.place <= 3 ? (
                  <RankMedal rank={row.place as 1 | 2 | 3} />
                ) : (
                  num(INT_FORMAT).format(row.place)
                )}
              </TableCell>
              <TableCell>
                <ClanName
                  region={region}
                  clan={{
                    // The board carries the tag it saw; a clan whose tag we
                    // never read still links by the id it is keyed on.
                    tag: row.tag ?? String(row.clanId),
                    name: row.name,
                  }}
                />
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {num(INT_FORMAT).format(row.famePoints)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {num(INT_FORMAT).format(row.victories)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {num(INT_FORMAT).format(row.defeats)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePager pager={pager} />
    </div>
  );
}
