"use client";

import Image from "next/image";
import { identityFromRow } from "@/components/entity/player-identity";
import { PlayerName } from "@/components/entity/player-name";
import type { OnslaughtRow } from "@/components/players/list/onslaught/row";
import { RankMedal } from "@/components/rank-medal";
import { TableCell, TableRow } from "@/components/ui/table";
import ROUTES from "@/constants/routes";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import {
  ONSLAUGHT_TIER_COLOR,
  onslaughtRankIcon,
  type OnslaughtTier,
  RATING_COLOR_CLASS,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const RATE_FORMAT = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

/**
 * Rounded away from a signed zero.
 *
 * Points per day is the one column here that goes negative, and rounded to a
 * whole number a player at -0.4 prints as "-0", which reads as a typo rather
 * than as "barely losing". Rounding first collapses both -0.4 and +0.4 to a
 * plain 0, which is what a whole-number column can honestly say about them.
 */
function whole(value: number): number {
  const rounded = Math.round(value);
  return rounded === 0 ? 0 : rounded;
}

/** A rate the season has no captures behind, which is not a zero. */
function Absent() {
  return <span className="text-muted-foreground/60">-</span>;
}

/** One standings row: identity, rank tier, the season's rates, then the two
 * totals the source itself publishes. */
export function OnslaughtBoardRow({
  region,
  row,
  tier,
  seasonOrdinal,
  assetsRef,
}: {
  region: Region;
  row: OnslaughtRow;
  tier: OnslaughtTier | null;
  seasonOrdinal: string | null;
  assetsRef: string | null;
}) {
  const { num } = useFormat();
  const { t } = useTranslation("components/players/list/onslaught/view");
  const { t: tGame } = useTranslation("game/vocabulary");
  const colorClass = tier ? RATING_COLOR_CLASS[ONSLAUGHT_TIER_COLOR[tier]] : "";

  return (
    <TableRow>
      <TableCell className="text-center text-muted-foreground tabular-nums">
        {row.rank <= 3 ? (
          <RankMedal rank={row.rank as 1 | 2 | 3} className="mx-auto" />
        ) : (
          row.rank
        )}
      </TableCell>
      <TableCell>
        <div className="flex min-w-0 items-center gap-2">
          <PlayerName
            region={region}
            player={identityFromRow(row)}
            href={ROUTES.PLAYER_ONSLAUGHT(region, row.nickname)}
          />
          {row.recordedNickname !== row.nickname ||
          row.recordedClanTag !== row.clan_tag ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("alias", {
                nickname: row.recordedClanTag
                  ? `${row.recordedNickname} [${row.recordedClanTag}]`
                  : row.recordedNickname,
              })}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="hidden text-right sm:table-cell">
        {tier ? (
          <span className="inline-flex items-center justify-end gap-1.5">
            <Image
              src={onslaughtRankIcon(tier, seasonOrdinal, assetsRef)}
              alt=""
              width={22}
              height={22}
              className="h-5 w-5 shrink-0"
            />
            <span
              className={cn(
                "rounded px-2 py-0.5 text-xs font-semibold",
                colorClass,
              )}
            >
              {tGame(`onslaught-tiers.${tier}`)}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="hidden text-right text-muted-foreground tabular-nums xl:table-cell">
        {row.battlesPerDay == null ? (
          <Absent />
        ) : (
          num(INT_FORMAT).format(row.battlesPerDay)
        )}
      </TableCell>
      <TableCell className="hidden text-right text-muted-foreground tabular-nums xl:table-cell">
        {row.pointsPerDay == null ? (
          <Absent />
        ) : (
          num(INT_FORMAT).format(whole(row.pointsPerDay))
        )}
      </TableCell>
      <TableCell className="hidden text-right text-muted-foreground tabular-nums xl:table-cell">
        {row.pointsPerBattle == null ? (
          <Absent />
        ) : (
          num(RATE_FORMAT).format(row.pointsPerBattle)
        )}
      </TableCell>
      <TableCell className="text-right text-muted-foreground tabular-nums">
        {num(INT_FORMAT).format(row.battles)}
      </TableCell>
      <TableCell
        className={cn("text-right font-semibold tabular-nums", colorClass)}
      >
        {num(INT_FORMAT).format(row.rating)}
      </TableCell>
    </TableRow>
  );
}
