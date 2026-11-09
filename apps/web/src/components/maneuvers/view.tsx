"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/segmented-control";
import { useTranslation } from "@/hooks/use-translation";
import { useFormat } from "@/hooks/use-format";
import { ManeuversClansTable } from "./clans-table";
import { ManeuversPlayersTable } from "./players-table";
import type { ManeuversBoard } from "@/services/maneuvers/leaderboard";
import type { Region } from "@unicum.gg/wargaming";

type Board = "players" | "clans";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const DAY = "d MMMM yyyy";
const INSTANT = "d MMM, HH:mm";

/**
 * Both boards ship in the HTML and the switch only chooses which one is shown,
 * so the page stays static: reading the choice from `searchParams` would turn
 * the route dynamic for every visitor, and this is one payload either way.
 */
export function ManeuversView({
  region,
  board,
}: {
  region: Region;
  board: ManeuversBoard;
}) {
  const { t } = useTranslation("components/maneuvers/view");
  // The event's name is Wargaming's and is already written down per language
  // (French reads "Manœuvres"), so it is read from the catalogue rather than
  // translated again inside each sentence.
  const { t: tGame } = useTranslation("game/vocabulary");
  const { num, date } = useFormat();
  const [shown, setShown] = useState<Board>("players");

  const { edition, standing, players, clans } = board;

  // Nothing has ever been recorded for this region. Said plainly rather than
  // drawn as an empty table, which reads as a board everybody lost.
  if (!edition) {
    return <p className="text-muted-foreground text-sm">{t("no-edition")}</p>;
  }

  const notStarted = !standing || (players.length === 0 && clans.length === 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
          {tGame("battle-formats.maneuvers")}
        </h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          {edition.startDate && edition.endDate
            ? t("window", {
                from: date(DAY).format(edition.startDate),
                to: date(DAY).format(edition.endDate),
              })
            : t("intro")}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
          label={t("ranked-players")}
          value={standing ? num(INT_FORMAT).format(standing.playerCount) : null}
        />
        <Figure
          label={t("ranked-clans")}
          value={standing ? num(INT_FORMAT).format(standing.clanCount) : null}
        />
      </dl>

      {notStarted ? (
        <p className="text-muted-foreground text-sm">
          {edition.startDate
            ? t("not-started", { date: date(DAY).format(edition.startDate) })
            : t("not-started-undated")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              active={shown}
              segments={[
                {
                  id: "players" as const,
                  label: t("players"),
                  count: players.length,
                },
                {
                  id: "clans" as const,
                  label: t("clans"),
                  count: clans.length,
                },
              ]}
              onSelect={setShown}
            />
            {standing ? (
              <p className="text-muted-foreground text-xs">
                {t("recomputed", {
                  at: date(INSTANT).format(standing.capturedAt),
                })}
              </p>
            ) : null}
          </div>

          <div hidden={shown !== "players"}>
            <ManeuversPlayersTable
              region={region}
              rows={players}
              cutoffPlace={edition.tankRewardPositions}
            />
          </div>
          <div hidden={shown !== "clans"}>
            <ManeuversClansTable
              region={region}
              rows={clans}
              cutoffPlace={edition.clanGoldPositions}
            />
          </div>
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
