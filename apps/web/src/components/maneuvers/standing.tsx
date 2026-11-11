"use client";

import { ManeuversBoardKind } from "@unicum.gg/shared";
import Link from "@/components/link";
import { FamePoints, FamePointsBadge } from "@/components/maneuvers/fame-points";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

/** One entry's row on an edition's board, as a profile tab reads it. */
export type ManeuversStandingData = {
  place: number;
  famePoints: number;
  ranked: number | null;
  rewardPositions: number | null;
  gain24h?: number | null;
  placeChange24h?: number | null;
};

/**
 * Where a player or a clan stands on the edition being played, given the room a
 * placing deserves: the place, the Fame Points in the board's own colour, the
 * day's move, and how far it sits from the reward line (a vehicle for a
 * player, gold for a clan), in Fame Points when the line's price is known.
 */
export function ManeuversStanding({
  kind,
  standing,
  href,
  edition,
  cutoffPoints,
}: {
  kind: ManeuversBoardKind;
  standing: ManeuversStandingData;
  /** The board this is a place on. */
  href: string;
  edition: string;
  cutoffPoints: number | null;
}) {
  const { t } = useTranslation("components/maneuvers/standing");
  const { num } = useFormat();
  const fmt = num(INT_FORMAT);
  const line = standing.rewardPositions;
  const inside = line != null && standing.place <= line;
  const margin = cutoffPoints != null ? standing.famePoints - cutoffPoints : null;
  const move = standing.placeChange24h ?? null;

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={href}
          className="text-2xl font-semibold tabular-nums hover:underline"
          title={t("see-board")}
        >
          #{fmt.format(standing.place)}
        </Link>
        <FamePointsBadge
          value={standing.famePoints}
          place={standing.place}
          ranked={standing.ranked ?? 0}
        />
        {move != null && move !== 0 ? (
          <span
            className={cn(
              "text-sm tabular-nums",
              move > 0 ? "text-emerald-500" : "text-red-500",
            )}
          >
            {t(move > 0 ? "climbed" : "fell", { count: fmt.format(Math.abs(move)) })}
          </span>
        ) : null}
      </div>
      <div className="text-sm text-fd-muted-foreground">
        <Link href={href} className="hover:underline">
          {edition}
        </Link>
        {standing.ranked != null
          ? ` · ${t(`of-ranked.${kind}`, { count: fmt.format(standing.ranked) })}`
          : null}
        {standing.gain24h != null
          ? ` · ${t("gain", { points: fmt.format(standing.gain24h) })}`
          : null}
      </div>
      {line != null ? (
        <div
          className={cn(
            "text-sm",
            inside ? "text-fd-foreground" : "text-fd-muted-foreground",
          )}
        >
          {inside
            ? margin != null
              ? t(`inside-points.${kind}`, { points: fmt.format(margin) })
              : t(`inside-places.${kind}`, { places: fmt.format(line - standing.place) })
            : margin != null
              ? t(`outside-points.${kind}`, { points: fmt.format(-margin) })
              : t(`outside-places.${kind}`, { places: fmt.format(standing.place - line) })}
        </div>
      ) : null}
    </div>
  );
}

/** An earlier edition, one line: where the entry placed and whether it paid. */
export function ManeuversPastEdition({
  kind,
  standing,
  href,
  edition,
}: {
  kind: ManeuversBoardKind;
  standing: ManeuversStandingData;
  href: string;
  edition: string;
}) {
  const { t } = useTranslation("components/maneuvers/standing");
  const { num } = useFormat();
  const won =
    standing.rewardPositions != null && standing.place <= standing.rewardPositions;
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
      <Link href={href} className="font-medium hover:underline">
        {edition}
      </Link>
      <Link href={href} className="tabular-nums text-fd-muted-foreground hover:underline">
        #{num(INT_FORMAT).format(standing.place)}
      </Link>
      <FamePoints value={standing.famePoints} className="text-fd-muted-foreground" />
      {won ? (
        <span className="rounded bg-fd-secondary/60 px-1.5 py-0.5 text-xs font-medium">
          {t(`won.${kind}`)}
        </span>
      ) : null}
    </li>
  );
}
