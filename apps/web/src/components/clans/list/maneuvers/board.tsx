"use client";

import { ManeuversClansTable } from "@/components/maneuvers/clans-table";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import type { ManeuversBoard } from "@/services/maneuvers/leaderboard";
import type { Region } from "@unicum.gg/wargaming";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const INSTANT = "d MMM, HH:mm";

/**
 * Everything below the clan maneuvers hero: the two figures that frame the clan
 * board (what a gold place costs and how many hold one), the instant the source
 * last recomputed, and the ranked table itself.
 *
 * Client for the same reasons as its player twin: the table paginates in the
 * browser and the figures read through `useFormat`.
 */
export function ManeuversClansBoard({
  region,
  board,
}: {
  region: Region;
  board: ManeuversBoard;
}) {
  const { t } = useTranslation("components/clans/list/maneuvers/view");
  const { num, date } = useFormat();
  const { edition, standing, clans } = board;

  if (!edition) {
    return <p className="text-muted-foreground text-sm">{t("no-edition")}</p>;
  }

  const notStarted = !standing || clans.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-4">
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

      {notStarted ? (
        <p className="text-muted-foreground text-sm">
          {edition.startDate
            ? t("not-started", { date: date("d MMMM yyyy").format(edition.startDate) })
            : t("not-started-undated")}
        </p>
      ) : (
        <>
          {standing ? (
            <p className="text-muted-foreground text-xs">
              {t("recomputed", { at: date(INSTANT).format(standing.capturedAt) })}
            </p>
          ) : null}
          <ManeuversClansTable
            region={region}
            rows={clans}
            cutoffPlace={edition.clanGoldPositions}
          />
        </>
      )}
    </div>
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
