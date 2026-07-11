import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Panel,
  PanelContent,
  PanelSeparator,
} from "@/components/panel";
import { TanksIndex } from "@/components/tanks/tanks-index";
import { TankTab, tankTabFromQuery } from "@/components/tanks/tabs";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { listTanks } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { getAllTankSpecs } from "@unicum.gg/core/wargaming/wot/tanks/specs";
import { getAllTankStats } from "@unicum.gg/core/wargaming/wot/players/top/by-tank";
import { getTankMomByRegion } from "@unicum.gg/core/mom";
import { getTankMoeByRegion } from "@unicum.gg/core/moe";
import {
  type Region,
  isRegion,
  REGION_EMOJI,
  REGION_LABEL,
} from "@unicum.gg/wargaming/region";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  if (!isRegion(region)) return {};
  const regionLabel = region.toUpperCase();
  return constructMetadata({
    title: `All World of Tanks tanks (${regionLabel}), browse every vehicle`,
    description: `Browse every World of Tanks tank on ${regionLabel}: filter by tier, nation, class and role, then dive into per-tank stats, top players and expected values.`,
    ogImage: false,
  });
}

export default async function TanksIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ region }, { tab }] = await Promise.all([params, searchParams]);
  if (!isRegion(region)) notFound();
  return renderTanksIndex(region, tankTabFromQuery(tab));
}

export async function renderTanksIndex(
  region: Region,
  activeTab: TankTab = TankTab.Performances,
) {
  const [tanks, statsByTank, specsByTank, momByTank, moeByTank] =
    await Promise.all([
      listTanks(region),
      getAllTankStats(region),
      getAllTankSpecs(),
      getTankMomByRegion(region),
      getTankMoeByRegion(region),
    ]);
  const items = tanks
    .map((t) => {
      const s = statsByTank.get(t.tankId);
      return {
        tankId: t.tankId,
        slug: t.slug,
        name: t.meta.name,
        shortName: t.meta.shortName,
        tag: t.meta.tag,
        tier: t.meta.tier,
        nation: t.meta.nation,
        type: t.meta.type,
        role: t.meta.role,
        isPremium: t.meta.isPremium,
        isReward: t.meta.isReward,
        stats: s
          ? {
              players: s.players,
              battles: s.total_battles,
              wr: s.winrate,
              playerWr: s.player_wr,
              dpg: s.avg_damage,
              wn7: s.wn7,
              wn8: s.wn8,
              wnx: s.wnx,
              kdr: s.kdr,
              assists: s.avg_assist,
              hitPct: s.hit_pct,
              penPct: s.pen_pct,
              spots: s.avg_spots,
              blocked: s.avg_blocked,
              survival: s.survival,
            }
          : null,
        specs: specsByTank.get(t.tankId) ?? null,
        mastery: momByTank.get(t.tankId) ?? null,
        moe: moeByTank.get(t.tankId) ?? null,
      };
    })
    // Only real tiers 1-10(11); drop catalogue entries with no meaningful tier.
    .filter((t) => t.tier > 0 && t.name.length > 0);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            All <span className="text-[#f25322]">tanks</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            Every one of the {intFmt.format(items.length)} World of Tanks
            vehicles on {REGION_LABEL[region]}. Filter by tier, nation, class
            and role, then open a tank for its stats, best players and expected
            values.
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <TanksIndex
        tanks={items}
        region={region}
        activeTab={activeTab}
        basePath={ROUTES.TANKS(region)}
      />
    </div>
  );
}
