import type { ReactNode } from "react";
import {
  RATING_METRIC_LABEL,
  RATING_METRICS,
  RatingMetric,
  type VehicleMeta,
  RATING_COLOR_CLASS,
  winrateColor,
  wn7Color,
  wn8Color,
  wnxColor,
  type WN8Expected,
  type WNXExpected,
} from "@unicum.gg/shared";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";
import type {
  TankServerStats,
  TopTankPlayersByMetric,
} from "@unicum.gg/core/wargaming/wot/players/top/by-tank";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import { TankTopPlayers } from "./top-players";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { cn } from "@/lib/utils";

const RATING_COL: Record<RatingMetric, "wn7" | "wn8" | "wnx"> = {
  [RatingMetric.Wn7]: "wn7",
  [RatingMetric.Wn8]: "wn8",
  [RatingMetric.Wnx]: "wnx",
};

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pctFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

/** The Performances tab: server-average stats, top players per rating metric,
 * and the WN8/WNX expected values. */
export function Performances({
  region,
  tankId,
  meta,
  serverStats,
  topByMetric,
  wn8Expected,
  wnxExpected,
}: {
  region: Region;
  tankId: number;
  meta: VehicleMeta;
  serverStats: TankServerStats | null;
  topByMetric: TopTankPlayersByMetric;
  wn8Expected: WN8Expected | null;
  wnxExpected: WNXExpected | null;
}) {
  return (
    <>
      {serverStats && (
        <>
          <Panel>
            <PanelHeader>
              <PanelTitle>{meta.name} server average</PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-3 p-4">
              <p className="text-sm text-fd-muted-foreground">
                How the average tracked {REGION_LABEL[region]} player performs on
                the {meta.shortName} ({intFmt.format(serverStats.players)} players
                {serverStats.total_battles !== null
                  ? `, ${intFmt.format(serverStats.total_battles)} battles, min. 100 each`
                  : ", min. 100 battles each"}
                ).
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <Stat
                  label="Avg battles"
                  value={intFmt.format(serverStats.avg_battles)}
                />
                <Stat
                  label="Avg damage"
                  value={intFmt.format(serverStats.avg_damage)}
                />
                <Stat
                  label="Win rate"
                  value={pctFmt.format(serverStats.winrate / 100)}
                  colorClass={
                    RATING_COLOR_CLASS[winrateColor(serverStats.winrate / 100)]
                  }
                />
                <Stat
                  label="Player WR"
                  value={
                    serverStats.player_wr !== null
                      ? pctFmt.format(serverStats.player_wr / 100)
                      : "—"
                  }
                  colorClass={
                    serverStats.player_wr !== null
                      ? RATING_COLOR_CLASS[
                          winrateColor(serverStats.player_wr / 100)
                        ]
                      : undefined
                  }
                />
                {/* Only the card matching the active rating metric shows, via
                    the html[data-rating-metric] cookie-painted CSS toggle. */}
                <div className="contents" data-rating-col="wn7">
                  <Stat
                    label={<RatingMetricInlineSelect />}
                    value={
                      serverStats.wn7 !== null
                        ? intFmt.format(serverStats.wn7)
                        : "—"
                    }
                    colorClass={
                      serverStats.wn7 !== null
                        ? RATING_COLOR_CLASS[wn7Color(serverStats.wn7)]
                        : undefined
                    }
                  />
                </div>
                <div className="contents" data-rating-col="wn8">
                  <Stat
                    label={<RatingMetricInlineSelect />}
                    value={
                      serverStats.wn8 !== null
                        ? intFmt.format(serverStats.wn8)
                        : "—"
                    }
                    colorClass={
                      serverStats.wn8 !== null
                        ? RATING_COLOR_CLASS[wn8Color(serverStats.wn8)]
                        : undefined
                    }
                  />
                </div>
                <div className="contents" data-rating-col="wnx">
                  <Stat
                    label={<RatingMetricInlineSelect />}
                    value={
                      serverStats.wnx !== null
                        ? intFmt.format(serverStats.wnx)
                        : "—"
                    }
                    colorClass={
                      serverStats.wnx !== null
                        ? RATING_COLOR_CLASS[wnxColor(serverStats.wnx)]
                        : undefined
                    }
                  />
                </div>
                <Stat
                  label="Assists"
                  value={
                    serverStats.avg_assist !== null
                      ? intFmt.format(serverStats.avg_assist)
                      : "—"
                  }
                />
                <Stat
                  label="Spots"
                  value={
                    serverStats.avg_spots !== null
                      ? decFmt.format(serverStats.avg_spots)
                      : "—"
                  }
                />
                <Stat
                  label="KDR"
                  value={
                    serverStats.kdr !== null
                      ? decFmt.format(serverStats.kdr)
                      : "—"
                  }
                />
                <Stat
                  label="Hit %"
                  value={
                    serverStats.hit_pct !== null
                      ? pctFmt.format(serverStats.hit_pct / 100)
                      : "—"
                  }
                />
                <Stat
                  label="Pen %"
                  value={
                    serverStats.pen_pct !== null
                      ? pctFmt.format(serverStats.pen_pct / 100)
                      : "—"
                  }
                />
                <Stat
                  label="Blocked"
                  value={
                    serverStats.avg_blocked !== null
                      ? intFmt.format(serverStats.avg_blocked)
                      : "—"
                  }
                />
                <Stat
                  label="Survival"
                  value={
                    serverStats.survival !== null
                      ? pctFmt.format(serverStats.survival / 100)
                      : "—"
                  }
                />
              </div>
            </PanelContent>
          </Panel>
          <PanelSeparator />
        </>
      )}

      <Panel>
        <PanelHeader className="flex items-center justify-between gap-3">
          <PanelTitle>
            Top {meta.name} players{" "}
            <span className="text-fd-muted-foreground">by</span>{" "}
            <RatingMetricInlineSelect />
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className="px-4 py-3 text-sm text-fd-muted-foreground">
            Best {meta.shortName} players on {REGION_LABEL[region]}, ranked by
            single-tank rating (min. 100 battles on the tank).
          </div>
          {RATING_METRICS.map((m) => (
            <div key={m} data-rating-col={RATING_COL[m]}>
              <TankTopPlayers
                players={topByMetric[m]}
                metric={m}
                metricLabel={RATING_METRIC_LABEL[m]}
                region={region}
              />
            </div>
          ))}
        </PanelContent>
      </Panel>

      {(wn8Expected || wnxExpected) && (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>{meta.name} expected values</PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-4 p-4">
              <p className="text-sm text-fd-muted-foreground">
                Reference targets for an average game on this tank. Beat these
                and your WN8 / WNX climb above 50%.
              </p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {wn8Expected && (
                  <>
                    <Stat label="Exp. damage (WN8)" value={intFmt.format(wn8Expected.expDamage)} />
                    <Stat label="Exp. frags (WN8)" value={decFmt.format(wn8Expected.expFrag)} />
                    <Stat label="Exp. spots (WN8)" value={decFmt.format(wn8Expected.expSpot)} />
                    <Stat label="Exp. win rate (WN8)" value={pctFmt.format(wn8Expected.expWinRate / 100)} />
                  </>
                )}
                {wnxExpected && (
                  <>
                    <Stat label="Exp. damage (WNX)" value={intFmt.format(wnxExpected.damage)} />
                    <Stat label="Exp. frags (WNX)" value={decFmt.format(wnxExpected.frags)} />
                    <Stat label="Exp. spots (WNX)" value={decFmt.format(wnxExpected.spots)} />
                    <Stat label="Exp. assist (WNX)" value={intFmt.format(wnxExpected.assist)} />
                  </>
                )}
              </div>
              <p className="text-xs text-fd-muted-foreground">
                Tank id {tankId}. Expected values are sourced from the community
                WN8 / WNX datasets and refresh automatically.
              </p>
            </PanelContent>
          </Panel>
        </>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  colorClass,
}: {
  label: ReactNode;
  value: string;
  colorClass?: string;
}) {
  // Each stat is a framed card. A rating stat (WN8/WNX) colours the whole card
  // with its rating colour + white text, instead of a bare pill floating around
  // the number among unframed stats.
  const colored = !!colorClass;
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3",
        colored ? cn(colorClass, "border-transparent") : "border-fd-border",
      )}
    >
      {/* Fixed-height, centered label row so a card whose label is a taller
          control (the rating metric select) keeps its value aligned with the
          plain-text cards. */}
      <div
        className={cn(
          "flex h-6 items-center text-xs uppercase tracking-wide",
          colored ? "text-white/75" : "text-fd-muted-foreground",
        )}
      >
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
