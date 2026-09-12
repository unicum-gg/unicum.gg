"use client";

import { useLocale } from "@onruntime/translations/react";
import { dateLocale } from "@/lib/date-locale";
import { useFormat } from "@/hooks/use-format";
import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import { format } from "date-fns";
import { GlossaryHeadTooltip } from "@/components/glossary/head-tooltip";
import { PlayerName } from "@/components/entity/player-name";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type ClanMemberStats, RATING_COLOR_CLASS, type RatingColor, winrateColor, wn7Color, wn8Color, wnxColor } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { clanRoleName } from "@/components/game-name";
import { useTranslation } from "@/hooks/use-translation";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const DEC_FORMAT = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;
const PCT_FORMAT = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

enum SortColumn {
  Name = "name",
  Role = "role",
  WN7 = "wn7",
  WN730d = "wn7_30d",
  WN8 = "wn8",
  WN830d = "wn8_30d",
  WNX = "wnx",
  WNX30d = "wnx_30d",
  WR = "wr",
  Battles = "battles",
  Joined = "joined",
}

enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}

type SortState = { column: SortColumn; direction: SortDirection } | null;

function getSortValue(
  m: ClanMemberStats,
  column: SortColumn,
): number | string {
  switch (column) {
    case SortColumn.Name:
      return m.name.toLowerCase();
    case SortColumn.Role:
      // roleRank is the ClanRole enum index (0 = commander), so negate it to
      // make "descending" mean most senior first like every other column.
      return -m.roleRank;
    case SortColumn.WN7:
      return m.wn7 ?? -1;
    case SortColumn.WN730d:
      return m.wn730d ?? -1;
    case SortColumn.WN8:
      return m.wn8 ?? -1;
    case SortColumn.WN830d:
      return m.wn830d ?? -1;
    case SortColumn.WNX:
      return m.wnx ?? -1;
    case SortColumn.WNX30d:
      return m.wnx30d ?? -1;
    case SortColumn.WR:
      return m.overall?.winsPercentage ?? -1;
    case SortColumn.Battles:
      return m.overall?.battles ?? -1;
    case SortColumn.Joined:
      // Bigger daysInClan = joined longer ago. Sorting descending shows the
      // oldest members first, which matches what `Joined` usually means.
      return m.daysInClan;
  }
}

function compareMembers(
  a: ClanMemberStats,
  b: ClanMemberStats,
  state: SortState,
): number {
  if (!state) {
    if (a.roleRank !== b.roleRank) return a.roleRank - b.roleRank;
    return (b.personalRating ?? -1) - (a.personalRating ?? -1);
  }
  const mul = state.direction === SortDirection.Asc ? 1 : -1;
  const av = getSortValue(a, state.column);
  const bv = getSortValue(b, state.column);
  const cmp =
    typeof av === "string" && typeof bv === "string"
      ? av.localeCompare(bv)
      : (av as number) - (bv as number);
  // Within the same role, keep the best-rated members first so the default
  // Role sort matches the commander-first, then personal-rating order.
  if (cmp === 0 && state.column === SortColumn.Role) {
    return (b.personalRating ?? -1) - (a.personalRating ?? -1);
  }
  return mul * cmp;
}

function SortableHead({
  column,
  state,
  onToggle,
  align = "start",
  /** The glossary term this column is about, when the heading no longer spells
   * it: the heading is translated, the term is the English name the anchors are
   * keyed by. */
  term,
  ratingCol,
  hideOnMobile,
  headClassName,
  children,
}: {
  column: SortColumn;
  state: SortState;
  onToggle: (col: SortColumn) => void;
  align?: "start" | "end";
  term?: string;
  ratingCol?: string;
  hideOnMobile?: boolean;
  headClassName?: string;
  children: React.ReactNode;
}) {
  const active = state?.column === column;
  const Icon = active
    ? state.direction === SortDirection.Asc
      ? CaretUpIcon
      : CaretDownIcon
    : CaretUpDownIcon;
  const button = (
    <button
      type="button"
      onClick={() => onToggle(column)}
      className={cn(
        "flex w-full cursor-pointer items-center gap-1.5 px-3 py-2 text-left font-medium select-none hover:text-foreground",
        align === "end" && "justify-end",
        active ? "text-foreground" : "",
      )}
    >
      {/* `data-head-label` is what the tooltip measures: it shows the full
            heading only when the column really cut it. */}
      <span data-head-label className="truncate">
        {children}
      </span>
      <Icon
        weight="bold"
        className={cn("size-3.5 shrink-0", active ? "opacity-100" : "opacity-40")}
      />
    </button>
  );
  return (
    <TableHead
      data-rating-col={ratingCol}
      className={cn(
        "p-0",
        hideOnMobile && "hidden sm:table-cell",
        headClassName,
      )}
    >
      <GlossaryHeadTooltip
        label={term ?? (typeof children === "string" ? children : undefined)}
      >
        {button}
      </GlossaryHeadTooltip>
    </TableHead>
  );
}

function RatingCell({
  value,
  color,
  ratingCol,
}: {
  value: number | null;
  color: RatingColor | null;
  ratingCol?: string;
}) {
  const { num } = useFormat();
  if (value === null) {
    return (
      <TableCell
        data-rating-col={ratingCol}
        className="text-right text-muted-foreground tabular-nums"
      >
        —
      </TableCell>
    );
  }
  return (
    <TableCell
      data-rating-col={ratingCol}
      className={cn(
        "text-right tabular-nums",
        color && RATING_COLOR_CLASS[color],
      )}
    >
      {num(DEC_FORMAT).format(value)}
    </TableCell>
  );
}

// One placeholder row matching the 12 columns (same alignment + rating-column
// tags, so the rating-column toggle keeps the skeleton aligned with the header).
// Each bar sits in an h-6 line-box so the row matches the real 24px content
// height (name line-height / LiveBadge) instead of collapsing to the bar height.
function MemberRowSkeleton() {
  const bar = (w: string, justify = "justify-end") => (
    <div className={cn("flex h-6 items-center", justify)}>
      <Skeleton className={cn("h-4", w)} />
    </div>
  );
  const rating = (col: string) => (
    <TableCell key={col} data-rating-col={col}>
      {bar("w-10")}
    </TableCell>
  );
  return (
    <TableRow>
      <TableCell>{bar("w-4")}</TableCell>
      <TableCell>{bar("w-28", "justify-start")}</TableCell>
      <TableCell className="hidden sm:table-cell">
        {bar("w-16", "justify-start")}
      </TableCell>
      {rating("wn7")}
      {rating("wn7-30d")}
      {rating("wn8")}
      {rating("wn8-30d")}
      <TableCell className="max-[480px]:hidden">{bar("w-10")}</TableCell>
      {rating("wnx")}
      {rating("wnx-30d")}
      <TableCell className="hidden sm:table-cell">{bar("w-12")}</TableCell>
      <TableCell className="hidden sm:table-cell">{bar("w-16")}</TableCell>
    </TableRow>
  );
}

export function ClanMembersTable(
  props: { loading: true } | { region: Region; members: ClanMemberStats[] },
) {
  const { locale } = useLocale();
  const { num } = useFormat();
  const { t } = useTranslation(
    "components/clans/detail/overview/members-table",
  );
  const { t: tRoles } = useTranslation("game/clan-roles");
  const [sort, setSort] = useState<SortState>({
    column: SortColumn.Role,
    direction: SortDirection.Desc,
  });

  const loading = "loading" in props;
  const sorted = loading
    ? []
    : [...props.members].sort((a, b) => compareMembers(a, b, sort));

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
    <Table className="my-0! [&_td]:min-w-0 [&_td]:py-1.5! [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-3! [&_tr>*:first-child]:w-12 [&_thead_th:nth-child(2)>button]:pl-4! [&_thead_th:last-child>button]:pr-3!">
      <TableHeader>
        <TableRow>
          <TableHead className="px-3! py-2! text-right!">#</TableHead>
          <SortableHead
            column={SortColumn.Name}
            term="Player"
            state={sort}
            onToggle={toggleSort}
          >
            {t("player")}
          </SortableHead>
          <SortableHead
            column={SortColumn.Role}
            term="Role"
            state={sort}
            onToggle={toggleSort}
            hideOnMobile
          >
            {t("role")}
          </SortableHead>
          <SortableHead
            column={SortColumn.WN7}
            state={sort}
            onToggle={toggleSort}
            align="end"
            ratingCol="wn7"
          >
            {t("wn7")}</SortableHead>
          <SortableHead
            column={SortColumn.WN730d}
            state={sort}
            onToggle={toggleSort}
            align="end"
            ratingCol="wn7-30d"
          >
            {t("period", { metric: "WN7" })}
          </SortableHead>
          <SortableHead
            column={SortColumn.WN8}
            state={sort}
            onToggle={toggleSort}
            align="end"
            ratingCol="wn8"
          >
            {t("wn8")}</SortableHead>
          <SortableHead
            column={SortColumn.WN830d}
            state={sort}
            onToggle={toggleSort}
            align="end"
            ratingCol="wn8-30d"
          >
            {t("period", { metric: "WN8" })}
          </SortableHead>
          <SortableHead
            column={SortColumn.WR}
            state={sort}
            onToggle={toggleSort}
            align="end"
            headClassName="max-[480px]:hidden"
          >
            {t("wr")}</SortableHead>
          <SortableHead
            column={SortColumn.WNX}
            state={sort}
            onToggle={toggleSort}
            align="end"
            ratingCol="wnx"
          >
            {t("wnx")}</SortableHead>
          <SortableHead
            column={SortColumn.WNX30d}
            state={sort}
            onToggle={toggleSort}
            align="end"
            ratingCol="wnx-30d"
          >
            {t("period", { metric: "WNX" })}
          </SortableHead>
          <SortableHead
            column={SortColumn.Battles}
            term="Battles"
            state={sort}
            onToggle={toggleSort}
            align="end"
            hideOnMobile
          >
            {t("battles")}
          </SortableHead>
          <SortableHead
            column={SortColumn.Joined}
            term="Joined"
            state={sort}
            onToggle={toggleSort}
            align="end"
            hideOnMobile
          >
            {t("joined")}
          </SortableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: 12 }, (_, i) => <MemberRowSkeleton key={i} />)
          : sorted.map((m, idx) => {
          return (
            <TableRow key={m.accountId}>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {idx + 1}
              </TableCell>
              <TableCell className="font-medium">
                {/* The clan is the page's own subject, so the tag is not
                    repeated on every one of its members. Everything else about
                    the identity, crests included, is the site's usual format:
                    this table used to pass no tournament fields, so a member
                    who had won one wore nothing here and the crest on the home
                    leaderboard. */}
                <PlayerName
                  region={props.region}
                  player={{
                    nickname: m.name,
                    accountId: m.accountId,
                    isVerified: m.isVerified,
                    isSupporter: m.isSupporter,
                    twitchLogin: m.twitchLogin,
                    tournamentWins: m.tournamentWins,
                    tournamentFeaturedWins: m.tournamentFeaturedWins,
                    tournamentBestTitle: m.tournamentBestTitle,
                  }}
                />
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {clanRoleName(m.role, tRoles)}
              </TableCell>
              <RatingCell
                value={
                  m.wn7 ?? (m.overall && m.overall.battles === 0 ? 0 : null)
                }
                color={m.wn7 != null ? wn7Color(m.wn7) : null}
                ratingCol="wn7"
              />
              <RatingCell
                value={m.wn730d ?? (m.battles30d === 0 ? 0 : null)}
                color={m.wn730d != null ? wn7Color(m.wn730d) : null}
                ratingCol="wn7-30d"
              />
              <RatingCell
                value={
                  m.wn8 ?? (m.overall && m.overall.battles === 0 ? 0 : null)
                }
                color={m.wn8 != null ? wn8Color(m.wn8) : null}
                ratingCol="wn8"
              />
              <RatingCell
                value={m.wn830d ?? (m.battles30d === 0 ? 0 : null)}
                color={m.wn830d != null ? wn8Color(m.wn830d) : null}
                ratingCol="wn8-30d"
              />
              <TableCell
                className={cn(
                  "text-right tabular-nums max-[480px]:hidden",
                  m.overall &&
                    m.overall.battles > 0 &&
                    RATING_COLOR_CLASS[
                      winrateColor(m.overall.winsPercentage / 100)
                    ],
                )}
              >
                {m.overall ? `${num(PCT_FORMAT).format(m.overall.winsPercentage)}%` : "—"}
              </TableCell>
              <RatingCell
                value={
                  m.wnx ?? (m.overall && m.overall.battles === 0 ? 0 : null)
                }
                color={m.wnx != null ? wnxColor(m.wnx) : null}
                ratingCol="wnx"
              />
              <RatingCell
                value={m.wnx30d ?? (m.battles30d === 0 ? 0 : null)}
                color={m.wnx30d != null ? wnxColor(m.wnx30d) : null}
                ratingCol="wnx-30d"
              />
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {m.overall ? num(INT_FORMAT).format(m.overall.battles) : "—"}
              </TableCell>
              <TableCell className="hidden text-right text-xs text-muted-foreground tabular-nums sm:table-cell">
                {format(
                  // eslint-disable-next-line react-hooks/purity -- portal API only gives us days_in_clan, not the join timestamp, so we derive it from "now" at render time
                  new Date(Date.now() - m.daysInClan * 86_400_000),
                  "d MMM yyyy",
                  { locale: dateLocale(locale) },
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
