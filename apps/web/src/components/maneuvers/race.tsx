"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { RelativeTime } from "@/components/relative-time";
import { formatMoment, formatPlayers } from "@/components/servers/format";
import { useDisplayZone } from "@/components/servers/use-display-zone";
import { useManeuversEdition } from "@/components/maneuvers/edition-context";
import { FamePoints } from "@/components/maneuvers/fame-points";
import type { ManeuversBoardKind } from "@/components/maneuvers/rewards";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { unicum } from "@/services/sdk";

type HistoryData = Awaited<
  ReturnType<ReturnType<typeof unicum.region>["maneuversHistory"]>
>;
export type ManeuversHistoryPoint = HistoryData["points"][number];

// The charts arrive on their own, as on the Onslaught page: `ssr: false` keeps
// recharts out of the initial graph, and a chart carries no indexable text.
const ManeuversRaceCharts = dynamic(
  () => import("./race-charts").then((m) => m.ManeuversRaceCharts),
  { ssr: false, loading: () => <div className="h-64 w-full" /> },
);

/**
 * What a rewarded place costs, and how that price moved while the edition ran:
 * the Onslaught season race's twin.
 *
 * The figures are read off the board itself, so an edition always has them.
 * The curves exist only because the feeder sampled the board, since the source
 * publishes the current instant and keeps nothing, so they are fetched on their
 * own and wait for a second capture before drawing anything.
 */
export function ManeuversRace({ kind }: { kind: ManeuversBoardKind }) {
  const { t } = useTranslation("components/maneuvers/race");
  const { locale } = useFormat();
  const zone = useDisplayZone();
  const { region, board } = useManeuversEdition();
  const { edition, standing } = board;
  const eventName = edition?.eventName ?? null;

  const [history, setHistory] = useState<{
    id: string;
    points: ManeuversHistoryPoint[];
  } | null>(null);

  useEffect(() => {
    if (!eventName) return;
    let cancelled = false;
    unicum
      .region(region)
      .maneuversHistory(eventName)
      .then((res) => {
        if (!cancelled) setHistory({ id: eventName, points: res.points });
      })
      .catch(() => {
        if (!cancelled) setHistory({ id: eventName, points: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [region, eventName]);

  if (!edition || !standing) return null;

  const samples = history?.id === eventName ? history.points : [];
  const cutoff =
    kind === "players" ? standing.tankCutoffPoints : standing.clanGoldCutoffPoints;
  const ranked = kind === "players" ? standing.playerCount : standing.clanCount;
  const capturedAt = new Date(standing.capturedAt);
  const ended = edition.endDate != null && new Date(edition.endDate) < capturedAt;

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{t(ended ? "title-ended" : "title-live")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <dl className="flex flex-col divide-y divide-fd-border md:flex-row md:divide-x md:divide-y-0">
            <Cell
              title={t(`cutoff.${kind}`)}
              value={cutoff != null ? <FamePoints value={cutoff} size={22} /> : null}
              footer={t("fame-points")}
            />
            <Cell
              title={t(`ranked.${kind}`)}
              value={formatPlayers(ranked, locale)}
              footer={
                // How old the figures are, relative because the question is
                // whether they still describe the board. The instant stays on
                // hover.
                <RelativeTime
                  date={capturedAt}
                  title={formatMoment(capturedAt, zone, locale)}
                />
              }
            />
          </dl>

          {samples.length >= 2 ? (
            <ManeuversRaceCharts kind={kind} samples={samples} zone={zone} />
          ) : (
            <p className="border-t border-fd-border px-4 py-3 text-sm text-fd-muted-foreground">
              {history?.id === eventName ? t("no-curve") : " "}
            </p>
          )}
        </PanelContent>
      </Panel>
    </>
  );
}

function Cell({
  title,
  value,
  footer,
}: {
  title: string;
  value: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1 p-4">
      <dt className="text-xs uppercase tracking-wide text-fd-muted-foreground">
        {title}
      </dt>
      <dd className="text-2xl font-semibold tabular-nums">{value ?? "—"}</dd>
      <dd className="text-xs text-fd-muted-foreground">{footer}</dd>
    </div>
  );
}
