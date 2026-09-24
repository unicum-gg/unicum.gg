"use client";

import Image from "next/image";
import {
  ClimbOutlook,
  onslaughtRankIcon,
  OnslaughtRank,
  type ClimbPlan,
  type OnslaughtStanding,
} from "@unicum.gg/shared";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import {
  opensRank,
  standingName,
} from "@/components/players/list/onslaught/predict/rank-name";

const INT = { maximumFractionDigits: 0 } as const;
const ONE_DP = { maximumFractionDigits: 1 } as const;

/**
 * The ladder from where a player stands, one row per step they could still
 * reach, with what each would cost.
 *
 * The prediction above says where they land if nothing changes, and this says
 * what changing it is worth, which is the half a reader can act on: the next
 * division is usually a handful of battles, the next rank a weekend, and the
 * step after that the rest of the season or nothing at all.
 *
 * Each row is priced in battles AND in a daily pace, because the season has a
 * deadline: a hundred battles is nothing in three weeks and out of reach in
 * two days, and only the pace says which of those it is. The rows the
 * projection already reaches are marked, so the reader can see at a glance
 * where their current pace runs out.
 */
export function PredictLadder({
  rows,
  reached,
  previousLegend,
  seasonOrdinal,
  assetsRef,
}: {
  rows: { step: OnslaughtStanding; plan: ClimbPlan | null }[];
  /** The points the projection lands on, which is what marks a row as one the
   * reader's current pace already covers. */
  reached: number;
  /** What Legend cost when the last season settled. Every other step of the
   * ladder is a published number, and that one is a projection, so it is the
   * only row that owes the reader a precedent to judge it against. */
  previousLegend: number | null;
  seasonOrdinal: string | null;
  assetsRef: string | null;
}) {
  const { num } = useFormat();
  const { t } = useTranslation("components/players/list/onslaught/predict/ladder");
  const { t: tGame } = useTranslation("game/vocabulary");

  if (rows.length === 0) return null;

  return (
    <div className="border-b border-fd-border">
      <p className="px-4 pt-4 text-xs uppercase tracking-wide text-fd-muted-foreground">
        {t("title")}
      </p>
      <ul className="divide-y divide-fd-border">
        {rows.map(({ step, plan }) => {
          if (!plan) return null;
          const covered = reached >= step.floor;
          return (
            <li
              key={`${step.rank}-${step.division ?? ""}`}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
            >
              <span className="flex items-center gap-2 font-medium">
                <Image
                  src={onslaughtRankIcon(step.rank, seasonOrdinal, assetsRef)}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6"
                />
                {standingName(step, tGame, { rankOnly: opensRank(step) })}
                <span className="text-sm font-normal text-fd-muted-foreground tabular-nums">
                  {t("from", { points: num(INT).format(Math.round(step.floor)) })}
                  {step.rank === OnslaughtRank.Legend && previousLegend != null
                    ? ` ${t("previous", {
                        points: num(INT).format(previousLegend),
                      })}`
                    : null}
                </span>
              </span>
              <span
                className={cn(
                  "text-sm tabular-nums",
                  covered ? "text-emerald-500" : "text-fd-muted-foreground",
                )}
              >
                {t(
                  plan.outlook === ClimbOutlook.OutOfReach
                    ? "cost-out-of-reach"
                    : "cost",
                  {
                    battles: num(INT).format(Math.ceil(plan.battles)),
                    perDay: num(ONE_DP).format(plan.battlesPerDay),
                  },
                )}
                {covered ? (
                  <span className="ml-2">{t("on-your-pace")}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
