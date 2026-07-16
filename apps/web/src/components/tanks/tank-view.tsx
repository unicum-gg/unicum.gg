import type { ReactNode } from "react";
import Image from "next/image";
import { toRoman } from "roman-numerals";
import { NationFlag } from "@/components/players/nation-flag";
import type { SearchHistoryItem } from "@/hooks/use-search-history";
import { TankCost } from "@/components/tanks/tank-cost";
import { TankDetailTabs } from "@/components/tanks/tank-detail-tabs";
import { TankDetailTab } from "@/components/tanks/detail-tabs";
import { TankRender } from "@/components/tanks/tank-render";
import { TankActionsMenu } from "@/components/tanks/tank-actions-menu";
import { TankModules } from "@/components/tanks/tank-modules";
import { TankResearchPath } from "@/components/tanks/tank-research-path";
import ROUTES from "@/constants/routes";
import { TankCharacteristics } from "@/components/tanks/tank-characteristics";
import { TankMarksMastery } from "@/components/tanks/tank-marks-mastery";
import type { MomValues } from "@unicum.gg/core/mom";
import type { MomHistoryPoint } from "@unicum.gg/core/mom/poliroid";
import type { MoeValues } from "@unicum.gg/core/moe";
import type { MoeHistoryPoint } from "@unicum.gg/core/moe/poliroid";
import { type TankSpec, RATING_METRIC_LABEL, RATING_METRICS, RatingMetric, type VehicleMeta, RATING_COLOR_CLASS, winrateColor, wn7Color, wn8Color, wnxColor, type WN8Expected, type WNXExpected, VEHICLE_CLASS_LABEL_FULL, VEHICLE_ROLE_LABEL, roleSuffix } from "@unicum.gg/shared";
import { VehicleRoleIcon } from "@/components/players/vehicle-role-icon";
import { VehicleTypeIcon } from "@/components/players/vehicle-type-icon";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import { TankTopPlayers } from "@/components/tanks/tank-top-players";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import type {
  TankServerStats,
  TopTankPlayersByMetric,
} from "@unicum.gg/core/wargaming/wot/players/top/by-tank";
import type { ResearchBranch } from "@unicum.gg/core/wargaming/wot/tanks/research-path";
import type { TankModuleNode } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import { cn } from "@/lib/utils";
import { Region, REGION_LABEL, hangarBgUrl } from "@unicum.gg/wargaming";

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

export function TankView({
  region,
  tankId,
  slug,
  meta,
  topByMetric,
  serverStats,
  wn8Expected,
  wnxExpected,
  specs,
  moe,
  mom,
  researchPath,
  modules,
  moeHistory,
  momHistory,
}: {
  region: Region;
  tankId: number;
  slug: string;
  meta: VehicleMeta & { isWheeled?: boolean; isGift?: boolean };
  serverStats: TankServerStats | null;
  topByMetric: TopTankPlayersByMetric;
  wn8Expected: WN8Expected | null;
  wnxExpected: WNXExpected | null;
  specs: TankSpec | null;
  moe: MoeValues | null;
  mom: MomValues | null;
  researchPath: ResearchBranch;
  modules: TankModuleNode[];
  moeHistory: MoeHistoryPoint[];
  momHistory: MomHistoryPoint[];
}) {
  const tierLabel = meta.tier ? toRoman(meta.tier) : String(meta.tier);
  const classLabel = VEHICLE_CLASS_LABEL_FULL[meta.type] ?? meta.type;
  const roleSfx = roleSuffix(meta.role);

  const favoriteItem: SearchHistoryItem = {
    kind: "tank",
    region,
    tank: {
      tank_id: tankId,
      slug,
      name: meta.name,
      short_name: meta.shortName,
      tag: meta.tag,
      tier: meta.tier,
      nation: meta.nation,
      type: meta.type,
      is_premium: meta.isPremium,
    },
  };

  const performances = (
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
                the {meta.shortName} ({intFmt.format(serverStats.players)}{" "}
                players, min. 100 battles each).
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

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel className="border-b border-fd-border">
        <div className="relative min-h-[320px] overflow-hidden sm:min-h-[400px] lg:min-h-[470px]">
          {/* The exact hangar-floor backdrop WG's own tankopedia detail page
              uses (1920x900, matching the render), served from its portal CDN.
              `latest` keeps the URL stable across client version bumps. Rendered
              through next/image so it is resized/format-negotiated instead of
              shipping the full-size webp as a CSS background. */}
          <Image
            src={hangarBgUrl(region, "webp")}
            alt=""
            aria-hidden
            fill
            priority
            sizes="100vw"
            className="pointer-events-none object-cover object-center"
          />
          {/* Soft spotlight behind the vehicle. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(52%_66%_at_57%_36%,var(--color-fd-secondary)/45%,transparent_72%)]"
          />
          {/* High-res vehicle render, full-bleed (gunmarks / skill4ltu style). */}
          <div className="pointer-events-none absolute inset-0">
            <TankRender
              tag={meta.tag}
              region={region}
              fallback={meta.bigIcon}
              name={meta.name}
            />
          </div>
          {/* Left fade keeps the title legible over the render. Kept tight to
              the left (clears by ~58%) so it darkens the title area, not the
              vehicle render sitting in the centre. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-r from-fd-background from-0% via-fd-background/30 via-26% to-transparent to-58%"
          />
          {/* Wrap the fade around the top-left corner (diagonal from that
              corner) so the header labels sit on the same darkening, not just
              the left edge. Clears before the centre so the render stays lit. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-fd-background from-0% via-fd-background/20 via-28% to-transparent to-55%"
          />
          <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5">
            <TankActionsMenu
              region={region}
              tankId={tankId}
              tag={meta.tag}
              name={meta.name}
              slug={slug}
              favoriteItem={favoriteItem}
            />
          </div>
          {specs && (
            <div className="absolute bottom-4 right-4 z-10 sm:bottom-6 sm:right-6">
              <TankCost
                specs={specs}
                region={region}
                isReward={meta.isReward}
              />
            </div>
          )}
          <div className="relative z-10 space-y-2 px-6 py-8 sm:px-10 sm:py-10">
            <div className="flex flex-wrap items-center gap-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
              <span className="font-semibold text-[#f25322]">{tierLabel}</span>
              <NationFlag nation={meta.nation} region={region} variant="flag" />
              <VehicleTypeIcon type={meta.type} premium={meta.isPremium} />
              <span>{classLabel}</span>
              {roleSfx && (
                <span className="flex items-center gap-1">
                  <VehicleRoleIcon role={roleSfx} size={14} />
                  {VEHICLE_ROLE_LABEL[roleSfx]}
                </span>
              )}
              {meta.isReward ? (
                <span className="text-[#4FC4D9]">Reward</span>
              ) : meta.isPremium ? (
                <span className="text-[#FAB81B]">Premium</span>
              ) : null}
            </div>
            <h1 className="max-w-sm font-heading text-4xl font-bold tracking-tight md:text-5xl">
              {meta.name}
            </h1>
            <p className="max-w-sm text-sm text-fd-muted-foreground">
              World of Tanks {REGION_LABEL[region]} statistics for the{" "}
              {tierLabel} {meta.nation.toUpperCase()} {classLabel.toLowerCase()}{" "}
              {meta.name}.
            </p>
          </div>
        </div>
      </Panel>

      <PanelSeparator />

      <TankDetailTabs
        basePath={ROUTES.TANK(region, slug)}
        content={{
          [TankDetailTab.Specifications]:
            specs || researchPath.lineage.length > 0 || modules.length > 0 ? (
              <>
                {researchPath.lineage.length > 0 && (
                  <TankResearchPath
                    region={region}
                    lineage={researchPath.lineage}
                    next={researchPath.next}
                    currentId={tankId}
                    tankName={meta.name}
                  />
                )}
                {researchPath.lineage.length > 0 && specs && <PanelSeparator />}
                {specs && (
                  <TankCharacteristics specs={specs} tankName={meta.name} />
                )}
                {(researchPath.lineage.length > 0 || specs) &&
                  modules.length > 0 && <PanelSeparator />}
                {modules.length > 0 && (
                  <TankModules
                    region={region}
                    meta={meta}
                    nodes={modules}
                    nextTanks={researchPath.next}
                  />
                )}
                {specs?.description && (
                  <>
                    <PanelSeparator />
                    <Panel>
                      <PanelHeader>
                        <PanelTitle>{meta.name} historical reference</PanelTitle>
                      </PanelHeader>
                      <PanelContent className="px-4 py-4">
                        <p className="max-w-3xl text-sm leading-relaxed text-fd-muted-foreground">
                          {specs.description}
                        </p>
                      </PanelContent>
                    </Panel>
                  </>
                )}
              </>
            ) : null,
          [TankDetailTab.Performances]: performances,
          [TankDetailTab.Marks]:
            moe || mom ? (
              <TankMarksMastery
                moe={moe}
                mom={mom}
                moeHistory={moeHistory}
                momHistory={momHistory}
                serverStats={serverStats}
                tankName={meta.name}
              />
            ) : null,
        }}
      />
    </div>
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
