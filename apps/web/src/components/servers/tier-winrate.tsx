"use client";

import { useMemo } from "react";
import { toRoman } from "roman-numerals";
import {
  bandsOf,
  DEFAULT_RATING_METRIC,
  RATING_COLOR_HEX,
  RATING_METRIC_LABEL,
  type RatingBand,
  RatingMetric,
  ratingBandLabel,
  ratingMetricFromCookie,
  TIER_WINRATE_THIN_CELL,
  type TierWinrate,
  type TierWinrateCell,
  tierCellKey,
  winrateColor,
} from "@unicum.gg/shared";
import { REGION_LABEL, type Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import {
  formatPlayers,
  formatPlayersCompact,
  formatWinrate,
} from "./format";

/**
 * What each band of the region's players wins at each tier.
 *
 * A grid rather than a set of curves. Nine bands across eleven tiers is a
 * hundred numbers inside a range barely twenty points wide, and drawn as lines
 * they are nine strands in one corridor that the eye has to pull apart by
 * colour before it can read anything. As a grid each number is legible on its
 * own, and the shape everyone comes here for, whether the distance between the
 * bands opens or closes as the tiers go up, is the gradient down each column.
 *
 * Built like the weekly rhythm beside it, because it is the same object: a
 * spaced grid of small cells, each carrying its detail in a real tooltip rather
 * than a native `title`, each labelled for a reader who cannot hover at all.
 * What it adds is the figure inside the cell, which that grid has no room for
 * and this one does, and the fill, which is the win-rate band the number would
 * wear anywhere else on the site rather than a share of a maximum.
 */
/** `toRoman` answers "nulla" for 0 and throws below it, so a tier the
 * encyclopedia left unset would head a column with a Latin word or take the
 * page down. Guarded like every other tier label on the site. */
function tierLabel(tier: number): string {
  return tier > 0 ? toRoman(tier) : String(tier);
}

export function TierWinratePanel({
  grid,
  region,
}: {
  grid: TierWinrate;
  region: Region;
}) {
  // The same cookie the navbar selector writes, like the histograms above: the
  // grid follows the metric chosen anywhere on the site.
  const [stored] = useCookie(STORAGE.COOKIES.RATING, DEFAULT_RATING_METRIC);
  const metric: RatingMetric = ratingMetricFromCookie(stored);

  const cells = useMemo(() => grid.metrics[metric] ?? [], [grid, metric]);
  const byKey = useMemo(
    () =>
      new Map(cells.map((cell) => [tierCellKey(cell.band, cell.tier), cell])),
    [cells],
  );
  // The tiers that actually carry rows, ascending. Read off the payload rather
  // than counted to ten, so the day the game adds a tier the column appears
  // with it.
  const tiers = useMemo(
    () => [...new Set(cells.map((cell) => cell.tier))].sort((a, b) => a - b),
    [cells],
  );
  // Best band at the top, so the grid reads downwards the way a leaderboard
  // does. The bands come off the payload, which carries the edges each row was
  // banded with, so the axis cannot claim a threshold the rows were not
  // measured against.
  const bands = useMemo(
    () => [...bandsOf(cells, metric)].reverse(),
    [cells, metric],
  );

  const label = REGION_LABEL[region];
  // What the grid rests on, in the unit it is made of. The same weight as the
  // "median" beside the histograms above: a figure about the section rather
  // than part of its name.
  const battles = useMemo(
    () => cells.reduce((sum, cell) => sum + cell.battles, 0),
    [cells],
  );

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>What {label} players win by tier</PanelTitle>
      </PanelHeader>
      {/* No padding on the panel: the section carries its own, so its heading
          rule runs edge to edge like the panel's own does. */}
      <PanelContent className="p-0">
        <section className="border-b border-fd-border">
          {/* The same heading band the distribution panel's sections use, so
              both panels read alike on screen and in the outline. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-fd-border px-4 py-2.5">
            <PanelTitle as="h3" className="text-base">
              <RatingMetricInlineSelect /> band
            </PanelTitle>
            {battles > 0 ? (
              <span className="text-sm text-fd-muted-foreground">
                over{" "}
                <span className="font-medium tabular-nums text-fd-foreground">
                  {formatPlayersCompact(battles)}
                </span>{" "}
                battles
              </span>
            ) : null}
          </div>
          <div className="p-4">
            {tiers.length === 0 ? (
              // A metric with no rows at all: possible for a scale the pass has
              // not filled yet, and an empty grid under a full set of headers
              // would read as "nobody plays these tiers" rather than "not
              // computed".
              <p className="text-sm text-fd-muted-foreground">
                Nothing recorded against {RATING_METRIC_LABEL[metric]} yet. The
                grid is rebuilt nightly.
              </p>
            ) : (
              <Grid metric={metric} bands={bands} tiers={tiers} byKey={byKey} />
            )}
          </div>
        </section>

        <p className="p-4 text-sm text-fd-muted-foreground">
          A cell is the band&apos;s wins at that tier over its battles there,
          across every vehicle a player has at least{" "}
          {formatPlayers(grid.minBattles)} battles on, so it describes the tiers
          as played by the people who play them. Cells resting on fewer than{" "}
          {formatPlayersCompact(TIER_WINRATE_THIN_CELL)} battles are drawn
          faintly: they move for reasons other than skill. The colours are the
          same win-rate bands the site uses everywhere else.
        </p>
      </PanelContent>
    </Panel>
  );
}

function Grid({
  metric,
  bands,
  tiers,
  byKey,
}: {
  metric: RatingMetric;
  bands: RatingBand[];
  tiers: number[];
  byKey: Map<string, TierWinrateCell>;
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <div className="overflow-x-auto">
        {/* `table-fixed` so every tier is the same width, like the rhythm grid:
            left to `auto`, a column whose cells hold no sample comes out
            narrower than the rest, which reads as a fact about the tier. */}
        <table className="w-full min-w-[44rem] table-fixed border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="w-24 pe-2 text-right text-[11px] font-normal text-fd-muted-foreground">
                {RATING_METRIC_LABEL[metric]}
              </th>
              {tiers.map((tier) => (
                <th
                  key={tier}
                  scope="col"
                  className="text-center text-[11px] font-normal text-fd-muted-foreground"
                >
                  {tierLabel(tier)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bands.map((band) => (
              <tr key={band.color}>
                <th
                  scope="row"
                  className="pe-2 text-right text-[11px] font-normal tabular-nums text-fd-muted-foreground"
                >
                  {ratingBandLabel(band)}
                </th>
                {tiers.map((tier) => (
                  <td key={tier} className="p-0">
                    <Cell
                      cell={byKey.get(tierCellKey(band.color, tier))}
                      band={band}
                      tier={tier}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}

/**
 * One band at one tier.
 *
 * A thin cell keeps its colour and loses its weight, mixed towards the page
 * rather than dimmed with opacity, so it stays the same hue as the cells it is
 * being compared with. A cell with no sample at all is drawn as an empty slot:
 * "nobody in this band plays this tier" and "they win nothing there" must not
 * look alike.
 */
function Cell({
  cell,
  band,
  tier,
}: {
  cell: TierWinrateCell | undefined;
  band: RatingBand;
  tier: number;
}) {
  const where = `${ratingBandLabel(band)} at tier ${tierLabel(tier)}`;
  if (!cell) {
    return (
      <div
        role="img"
        className="h-7 rounded-[2px] border border-fd-border/40"
        aria-label={`${where}, no sample`}
      />
    );
  }

  const thin = cell.battles < TIER_WINRATE_THIN_CELL;
  const hex = RATING_COLOR_HEX[winrateColor(cell.winrate)];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* `role="img"` because the div carries both a figure and a name, and
            ARIA forbids naming a plain generic: without it the label is dropped
            and the cell is announced as a bare percentage, with no band and no
            tier. */}
        <div
          role="img"
          className={`flex h-7 items-center justify-center rounded-[2px] border border-fd-border/40 text-[11px] font-medium tabular-nums ${
            thin ? "text-fd-foreground/70" : "text-white"
          }`}
          style={{
            backgroundColor: thin
              ? `color-mix(in oklab, ${hex} 35%, transparent)`
              : hex,
          }}
          aria-label={`${where}, ${formatWinrate(cell.winrate)} win rate over ${formatPlayers(cell.battles)} battles`}
        >
          {formatWinrate(cell.winrate)}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{where}</span>
          <span className="text-background/70">
            {formatWinrate(cell.winrate)} over {formatPlayers(cell.battles)}{" "}
            battles from {formatPlayers(cell.players)} accounts
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
