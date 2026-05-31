"use client";

import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useState } from "react";
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
import type { MemberRatings } from "@/services/wargaming/wot/clans/ratings";
import type { ClanMemberStats } from "@/services/wargaming/wot/clans";
import type { Region } from "@/services/wargaming/wot";
import {
  RATING_COLOR_CLASS,
  type RatingColor,
  winrateColor,
  wn7Color,
  wn8Color,
} from "@/services/wargaming/wot/ratings";

function prettyRole(role: string): string {
  if (!role) return "—";
  return role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");
}

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

enum SortColumn {
  Name = "name",
  Role = "role",
  WN7 = "wn7",
  WN8 = "wn8",
  WNX = "wnx",
  WR = "wr",
  Battles = "battles",
  LastBattle = "last_battle",
}

enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}

type SortState = { column: SortColumn; direction: SortDirection } | null;

function getSortValue(
  m: ClanMemberStats,
  ratings: MemberRatings | undefined,
  column: SortColumn,
): number | string {
  switch (column) {
    case SortColumn.Name:
      return m.name.toLowerCase();
    case SortColumn.Role:
      return m.roleRank;
    case SortColumn.WN7:
      return ratings?.wn7 ?? -1;
    case SortColumn.WN8:
      return ratings?.wn8 ?? -1;
    case SortColumn.WNX:
      return ratings?.wnx ?? -1;
    case SortColumn.WR:
      return m.overall.winsPercentage;
    case SortColumn.Battles:
      return m.overall.battles;
    case SortColumn.LastBattle:
      return m.lastBattleTime?.getTime() ?? 0;
  }
}

function compareMembers(
  a: ClanMemberStats,
  b: ClanMemberStats,
  ratingsByAccount: Map<number, MemberRatings>,
  state: SortState,
): number {
  if (!state) {
    if (a.roleRank !== b.roleRank) return b.roleRank - a.roleRank;
    return b.personalRating - a.personalRating;
  }
  const mul = state.direction === SortDirection.Asc ? 1 : -1;
  const av = getSortValue(a, ratingsByAccount.get(a.accountId), state.column);
  const bv = getSortValue(b, ratingsByAccount.get(b.accountId), state.column);
  if (typeof av === "string" && typeof bv === "string") {
    return mul * av.localeCompare(bv);
  }
  return mul * ((av as number) - (bv as number));
}

function SortableHead({
  column,
  state,
  onToggle,
  align = "start",
  children,
}: {
  column: SortColumn;
  state: SortState;
  onToggle: (col: SortColumn) => void;
  align?: "start" | "end";
  children: React.ReactNode;
}) {
  const active = state?.column === column;
  const Icon = active
    ? state.direction === SortDirection.Asc
      ? CaretUpIcon
      : CaretDownIcon
    : CaretUpDownIcon;
  return (
    <TableHead className="p-0">
      <button
        type="button"
        onClick={() => onToggle(column)}
        className={cn(
          "flex w-full cursor-pointer items-center gap-1.5 px-3 py-2 text-left font-medium select-none hover:text-foreground",
          align === "end" && "justify-end",
          active ? "text-foreground" : "",
        )}
      >
        {children}
        <Icon
          weight="bold"
          className={cn("size-3.5", active ? "opacity-100" : "opacity-40")}
        />
      </button>
    </TableHead>
  );
}

function RatingCell({
  value,
  color,
}: {
  value: number | null;
  color: RatingColor | null;
}) {
  if (value === null) {
    return (
      <TableCell className="text-right text-muted-foreground tabular-nums">
        —
      </TableCell>
    );
  }
  return (
    <TableCell
      className={cn(
        "text-right tabular-nums",
        color && RATING_COLOR_CLASS[color],
      )}
    >
      {decFmt.format(value)}
    </TableCell>
  );
}

export function ClanMembersTable({
  region,
  members,
  ratingsByAccount,
}: {
  region: Region;
  members: ClanMemberStats[];
  ratingsByAccount: Map<number, MemberRatings>;
}) {
  const [sort, setSort] = useState<SortState>(null);

  const sorted = [...members].sort((a, b) =>
    compareMembers(a, b, ratingsByAccount, sort),
  );

  function toggleSort(column: SortColumn) {
    setSort((prev) => {
      if (prev?.column !== column) {
        return { column, direction: SortDirection.Desc };
      }
      if (prev.direction === SortDirection.Desc) {
        return { column, direction: SortDirection.Asc };
      }
      return null;
    });
  }

  return (
    <Table className="mt-6">
      <TableHeader>
        <TableRow>
          <TableHead className="w-10 text-right">#</TableHead>
          <SortableHead column={SortColumn.Name} state={sort} onToggle={toggleSort}>
            Player
          </SortableHead>
          <SortableHead column={SortColumn.Role} state={sort} onToggle={toggleSort}>
            Role
          </SortableHead>
          <SortableHead column={SortColumn.WN7} state={sort} onToggle={toggleSort} align="end">
            WN7
          </SortableHead>
          <SortableHead column={SortColumn.WN8} state={sort} onToggle={toggleSort} align="end">
            WN8
          </SortableHead>
          <SortableHead column={SortColumn.WNX} state={sort} onToggle={toggleSort} align="end">
            WNX
          </SortableHead>
          <SortableHead column={SortColumn.WR} state={sort} onToggle={toggleSort} align="end">
            WR
          </SortableHead>
          <SortableHead column={SortColumn.Battles} state={sort} onToggle={toggleSort} align="end">
            Battles
          </SortableHead>
          <SortableHead column={SortColumn.LastBattle} state={sort} onToggle={toggleSort} align="end">
            Last battle
          </SortableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((m, idx) => {
          const r = ratingsByAccount.get(m.accountId);
          return (
            <TableRow key={m.accountId}>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {idx + 1}
              </TableCell>
              <TableCell className="font-medium">
                <Link
                  href={ROUTES.PLAYER(region, m.name)}
                  className="hover:underline"
                >
                  {m.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {prettyRole(m.role)}
              </TableCell>
              <RatingCell
                value={
                  r?.wn7 ?? (m.overall.battles === 0 ? 0 : null)
                }
                color={r?.wn7 != null ? wn7Color(r.wn7) : null}
              />
              <RatingCell
                value={
                  r?.wn8 ?? (m.overall.battles === 0 ? 0 : null)
                }
                color={r?.wn8 != null ? wn8Color(r.wn8) : null}
              />
              <RatingCell
                value={
                  r?.wnx ?? (m.overall.battles === 0 ? 0 : null)
                }
                color={r?.wnx != null ? wn8Color(r.wnx) : null}
              />
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  m.overall.battles > 0 &&
                    RATING_COLOR_CLASS[
                      winrateColor(m.overall.winsPercentage / 100)
                    ],
                )}
              >
                {pctFmt.format(m.overall.winsPercentage)}%
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {intFmt.format(m.overall.battles)}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                {m.lastBattleTime
                  ? formatDistanceToNow(m.lastBattleTime, { addSuffix: true })
                  : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
