"use client";

import { ManeuversPlayersTable } from "@/components/maneuvers/players-table";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import type { ManeuversBoard } from "@/services/maneuvers/leaderboard";
import type { Region } from "@unicum.gg/wargaming";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const INSTANT = "d MMM, HH:mm";

/**
 * Everything below the player maneuvers hero: the two figures that frame the
 * player board (what a vehicle place costs and how many hold one), the instant
 * the source last recomputed, and the ranked table itself.
 *
 * A client component for the same reason the Onslaught board is one: the table
 * paginates in the browser (`usePagination`) and the figures read through
 * `useFormat`, so the numbers wear the reader's own locale. The page around it
 * stays server-rendered and ISR-cached.
 */
export function ManeuversPlayersBoard({
  region,
  board,
}: {
  region: Region;
  board: ManeuversBoard;
}) {
  const { t } = useTranslation("components/players/list/maneuvers/view");
  const { num, date } = useFormat();
  const { edition, standing, players } = board;

  // Nothing has ever been recorded for this region. Said plainly rather than
  // drawn as an empty table, which reads as a board everybody lost.
  if (!edition) {
    return <p className="text-muted-foreground text-sm">{t("no-edition")}</p>;
  }

  const notStarted = !standing || players.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-4">
        <Figure
          label={t("tank-cutoff")}
          hint={t("tank-cutoff-hint", {
            places: num(INT_FORMAT).format(edition.tankRewardPositions ?? 0),
          })}
          value={
            standing?.tankCutoffPoints == null
              ? null
              : num(INT_FORMAT).format(standing.tankCutoffPoints)
          }
        />
        <Figure
          label={t("ranked-players")}
          value={standing ? num(INT_FORMAT).format(standing.playerCount) : null}
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
          <ManeuversPlayersTable
            region={region}
            rows={players}
            cutoffPlace={edition.tankRewardPositions}
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
