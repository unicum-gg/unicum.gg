"use client";

import { useFormat } from "@/hooks/use-format";
import dynamic from "next/dynamic";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { formatMoment, formatPlayers } from "@/components/servers/format";
import { RelativeTime } from "@/components/relative-time";
import { useDisplayZone } from "@/components/servers/use-display-zone";
import type { unicum } from "@/services/sdk";
import { CHAMPION, LEGEND_DARK, LEGEND_LIGHT } from "./season-race-colors";
import { useTranslation } from "@/hooks/use-translation";
import { seasonName } from "@/components/game-name";

// The season-history payload, straight from the SDK.
type HistoryData = Awaited<
  ReturnType<ReturnType<typeof unicum.region>["players"]["onslaughtHistory"]>
>;
export type OnslaughtSeasonPoint = HistoryData["points"][number];

/** How the season before this one ended, from the board payload. */
export type OnslaughtPreviousSeason = NonNullable<
  Awaited<
    ReturnType<ReturnType<typeof unicum.region>["players"]["onslaught"]>
  >["previous"]
>;

// The charts arrive on their own. recharts is ~107 KB gzipped for a panel that
// sits below a few thousand table rows, and `ssr: false` is the part that keeps
// it out of the initial graph entirely (a server-rendered lazy component still
// downloads its chunk to hydrate). Nothing is lost: a chart carries no indexable
// text, and the figures above it are server-rendered as they are.
const OnslaughtSeasonCharts = dynamic(
  () => import("./season-race-charts").then((m) => m.OnslaughtSeasonCharts),
  { ssr: false, loading: () => <div className="h-64 w-full" /> },
);

const POINTS_FORMAT = {} as const;

/**
 * What a rank costs, and how that price moved while the season ran.
 *
 * The figures and the curves come from different places, and the panel is built
 * that way on purpose. What a rank costs right now is readable off the
 * standings themselves: the last Legend position holds a rating, and the bottom
 * of the board is Champion's threshold. How it MOVED exists only because we
 * sampled it, since Wargaming recomputes the board every few minutes and
 * publishes only that instant, keeping no history at all.
 *
 * So a season we never captured still has three figures to show, and it used to
 * show none: the panel was gated on the curve, so selecting the season before
 * the feeder existed left the reader with no thresholds at all, for a season
 * whose final standings we hold in full. The curves are the part that waits.
 *
 * Two charts rather than two axes: rating points and a headcount share no scale,
 * and a second y-axis would invite reading a crossing that means nothing.
 */
export function OnslaughtSeasonRace({
  points: samples,
  standings,
  ended,
  previous,
}: {
  points: OnslaughtSeasonPoint[];
  /** The board as it stands, read off the standings rather than off a capture,
   * so the thresholds are there for a season we hold no captures of. */
  standings: { ranked: number; legendPoints: number | null; championPoints: number | null };
  ended: boolean;
  /** Where the season before this one finished, drawn across both charts. It
   * is the only end state the page holds, and without it a curve that is two
   * thirds of the way through reads exactly like one that is finished. */
  previous: OnslaughtPreviousSeason | null;
}) {
  const { num } = useFormat();
  const { locale } = useFormat();
  const zone = useDisplayZone();
  const latest = samples.at(-1) ?? null;
  // The source's own published figure where we have it, the standings' own
  // where we do not. They are the same quantity read two ways and agree to the
  // point on every season we hold both for.
  const legendPoints = latest?.legendPoints ?? standings.legendPoints;
  const championPoints = latest?.championPoints ?? standings.championPoints;
  const ranked = latest?.ranked ?? standings.ranked;

  // One sample draws no line. The season opens this way and fills in on its own,
  // so the figures are shown regardless and only the curves wait.
  const { t } = useTranslation("components/players/list/onslaught/view");
  const { t: tOwn } = useTranslation("components/players/list/onslaught/season-race");
  const { t: tSeasons } = useTranslation("game/onslaught-seasons");
  const { t: tGame } = useTranslation("game/vocabulary");
  const legend = tGame("onslaught-tiers.legend");
  const champion = tGame("onslaught-tiers.champion");
  const plottable = samples.length >= 2;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>
          {t(ended ? "race.title-ended" : "race.title-live")}
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="p-0">
        <dl className="flex flex-col divide-y divide-fd-border md:flex-row md:divide-x md:divide-y-0">
          <Cell
            title={t("race.legend-cutoff", { legend })}
            value={
              legendPoints != null ? num(POINTS_FORMAT).format(legendPoints) : null
            }
            unit={t("race.rating-points")}
            swatch={{ light: LEGEND_LIGHT, dark: LEGEND_DARK }}
          />
          <Cell
            title={t("race.champion-cutoff", { champion })}
            value={
              championPoints != null
                ? num(POINTS_FORMAT).format(championPoints)
                : null
            }
            unit={t("race.rating-points")}
            swatch={{ light: CHAMPION, dark: CHAMPION }}
          />
          <Cell
            title={t("race.ranked-players")}
            value={formatPlayers(ranked, locale)}
            // How old the whole panel is. Relative rather than a clock reading,
            // because the question a reader has is whether these figures still
            // describe the board, and "18 minutes ago" answers it where
            // "02:10" makes them do the arithmetic. The exact instant stays on
            // hover.
            unit={latest ? undefined : " "}
            footer={
              latest ? (
                <RelativeTime
                  date={new Date(latest.t * 1000)}
                  title={formatMoment(new Date(latest.t * 1000), zone, locale)}
                />
              ) : null
            }
          />
          {previous ? (
            <Cell
              title={tOwn("previous.title")}
              value={
                previous.legendPoints != null
                  ? num(POINTS_FORMAT).format(previous.legendPoints)
                  : null
              }
              footer={tOwn("previous.footer", {
                season:
                  seasonName(
                    previous.seasonOrdinal,
                    previous.codename ?? "",
                    tSeasons,
                  ) ?? "",
                ranked: formatPlayers(previous.ranked, locale),
              })}
            />
          ) : null}
        </dl>

        {plottable ? (
          <OnslaughtSeasonCharts
            samples={samples}
            zone={zone}
            previous={previous}
          />
        ) : (
          <p className="border-t border-fd-border px-4 py-3 text-sm text-fd-muted-foreground">
            {/* Two silences again: a season that has not been sampled twice
                YET, and one that never will be because it ended before the
                capture existed. */}
            {ended ? tOwn("no-captures") : tOwn("the-curve-starts-once-the")}
          </p>
        )}
      </PanelContent>
    </Panel>
  );
}

function Cell({
  title,
  value,
  unit,
  footer,
  swatch,
}: {
  title: string;
  value: string | null;
  unit?: string;
  /** Rendered where `unit` would be, when the line is a node rather than text. */
  footer?: React.ReactNode;
  swatch?: { light: string; dark: string };
}) {
  return (
    <div className="flex flex-1 flex-col gap-1 p-4">
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-fd-muted-foreground">
        {swatch ? <Swatch {...swatch} /> : null}
        {title}
      </dt>
      <dd className="text-2xl font-semibold tabular-nums">{value ?? "—"}</dd>
      <dd className="text-xs text-fd-muted-foreground">
        {footer ?? unit ?? " "}
      </dd>
    </div>
  );
}

/** The line's colour beside its name, so a figure and its curve are one thing. */
function Swatch({ light, dark }: { light: string; dark: string }) {
  return (
    <>
      <span
        aria-hidden
        className="size-2 rounded-full dark:hidden"
        style={{ backgroundColor: light }}
      />
      <span
        aria-hidden
        className="hidden size-2 rounded-full dark:block"
        style={{ backgroundColor: dark }}
      />
    </>
  );
}
