"use client";

import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import { format, formatDistanceStrict } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import ROUTES from "@/constants/routes";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { PlayerClansTimeline } from "@/components/players/clans-timeline";
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
import type { ClanStint, PlayerClanHistoryFull } from "@unicum.gg/shared";

function prettyRole(role: string): string {
  if (!role) return "—";
  return role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");
}

const DAY_FORMAT = "MMM d, yyyy";

function formatDuration(from: Date, to: Date | null): string {
  return formatDistanceStrict(from, to ?? new Date());
}

function formatTotalDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  if (days < 30) return `${days} days`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years === 0) return `${months} months`;
  return months === 0 ? `${years}y` : `${years}y ${months}mo`;
}

const ROLE_ORDER: Record<string, number> = {
  recruit: 1,
  reservist: 2,
  private: 3,
  junior_officer: 4,
  recruitment_officer: 5,
  combat_officer: 6,
  intelligence_officer: 7,
  quartermaster: 8,
  personnel_officer: 9,
  executive_officer: 10,
  commander: 11,
};

enum SortColumn {
  Tag = "tag",
  Name = "name",
  Role = "role",
  From = "from",
  To = "to",
  Duration = "duration",
}

enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}

type SortState = { column: SortColumn; direction: SortDirection } | null;

function compareStints(a: ClanStint, b: ClanStint, state: SortState): number {
  if (!state) {
    const aActive = a.leftAt === null ? 1 : 0;
    const bActive = b.leftAt === null ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return b.joinedAt.getTime() - a.joinedAt.getTime();
  }
  const mul = state.direction === SortDirection.Asc ? 1 : -1;
  switch (state.column) {
    case SortColumn.Tag:
      return mul * a.clan.tag.localeCompare(b.clan.tag);
    case SortColumn.Name:
      return mul * a.clan.name.localeCompare(b.clan.name);
    case SortColumn.Role:
      return mul * ((ROLE_ORDER[a.role] ?? 0) - (ROLE_ORDER[b.role] ?? 0));
    case SortColumn.From:
      return mul * (a.joinedAt.getTime() - b.joinedAt.getTime());
    case SortColumn.To:
      return (
        mul *
        ((a.leftAt?.getTime() ?? Date.now()) -
          (b.leftAt?.getTime() ?? Date.now()))
      );
    case SortColumn.Duration: {
      const aDur = (a.leftAt?.getTime() ?? Date.now()) - a.joinedAt.getTime();
      const bDur = (b.leftAt?.getTime() ?? Date.now()) - b.joinedAt.getTime();
      return mul * (aDur - bDur);
    }
  }
}

function SortableHead({
  column,
  state,
  onToggle,
  align = "start",
  hideOnMobile,
  children,
}: {
  column: SortColumn;
  state: SortState;
  onToggle: (col: SortColumn) => void;
  align?: "start" | "end";
  hideOnMobile?: boolean;
  children: React.ReactNode;
}) {
  const active = state?.column === column;
  const Icon = active
    ? state.direction === SortDirection.Asc
      ? CaretUpIcon
      : CaretDownIcon
    : CaretUpDownIcon;
  return (
    <TableHead className={cn("p-0", hideOnMobile && "hidden sm:table-cell")}>
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

export function PlayerClansHistory({
  region,
  nickname,
  accountCreatedAt,
  clanHistory,
  nowMs,
}: {
  region: Region;
  nickname: string;
  accountCreatedAt: Date;
  clanHistory: PlayerClanHistoryFull;
  nowMs: number;
}) {
  const [sort, setSort] = useState<SortState>(null);

  const stints: ClanStint[] = clanHistory.currentStint
    ? [clanHistory.currentStint, ...clanHistory.pastStints]
    : clanHistory.pastStints;

  const sortedStints = [...stints].sort((a, b) => compareStints(a, b, sort));

  function toggleSort(column: SortColumn) {
    setSort((prev) => {
      if (prev?.column !== column) {
        return { column, direction: SortDirection.Asc };
      }
      if (prev.direction === SortDirection.Asc) {
        return { column, direction: SortDirection.Desc };
      }
      return null;
    });
  }

  return (
    <Panel>
      <PanelHeader>
        <div className="flex items-baseline justify-between gap-4">
          <PanelTitle>{nickname}&apos;s clans history</PanelTitle>
          {stints.length > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {clanHistory.totalClans} clans ·{" "}
              {formatTotalDuration(clanHistory.timeInClansSeconds)} in clans
            </p>
          )}
        </div>
      </PanelHeader>
      <PanelContent className="p-0">
        {stints.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No clan history.</p>
        ) : (
          <>
            <div className="p-4">
              <PlayerClansTimeline
                region={region}
                accountCreatedAt={accountCreatedAt}
                stints={stints}
                nowMs={nowMs}
              />
            </div>
            <Table className="my-0! border-t border-fd-border [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-3! [&_thead_th:first-child>button]:pl-4! [&_thead_th:last-child>button]:pr-3!">
              <TableHeader>
              <TableRow>
                <SortableHead column={SortColumn.Tag} state={sort} onToggle={toggleSort}>
                  Tag
                </SortableHead>
                <SortableHead column={SortColumn.Name} state={sort} onToggle={toggleSort}>
                  Name
                </SortableHead>
                <SortableHead
                  column={SortColumn.Role}
                  state={sort}
                  onToggle={toggleSort}
                  hideOnMobile
                >
                  Role
                </SortableHead>
                <SortableHead
                  column={SortColumn.From}
                  state={sort}
                  onToggle={toggleSort}
                  hideOnMobile
                >
                  From
                </SortableHead>
                <SortableHead column={SortColumn.To} state={sort} onToggle={toggleSort}>
                  To
                </SortableHead>
                <SortableHead
                  column={SortColumn.Duration}
                  state={sort}
                  onToggle={toggleSort}
                  align="end"
                >
                  Duration
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStints.map((s) => {
                const clanHref = ROUTES.CLAN(region, s.clan.tag);
                return (
                  <TableRow key={`${s.clan.id}-${s.joinedAt.getTime()}`}>
                    <TableCell className="font-semibold">
                      <Link href={clanHref} className="hover:underline">
                        <span style={{ color: s.clan.color }}>[</span>
                        {s.clan.tag}
                        <span style={{ color: s.clan.color }}>]</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={clanHref}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <Image
                          src={s.clan.emblem}
                          alt={`${s.clan.tag} emblem`}
                          width={20}
                          height={20}
                          className="size-5 shrink-0 rounded-sm"
                        />
                        {s.clan.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {prettyRole(s.role)}
                    </TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">
                      {format(s.joinedAt, DAY_FORMAT)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {s.leftAt ? (
                        format(s.leftAt, DAY_FORMAT)
                      ) : (
                        <span className="text-muted-foreground">current</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(s.joinedAt, s.leftAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
              </TableBody>
            </Table>
          </>
        )}
      </PanelContent>
    </Panel>
  );
}
