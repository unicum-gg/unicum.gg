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
import { getTankDataset } from "@unicum.gg/core/wargaming/wot/tanks/dataset";
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
  // Same in-process dataset the /tanks API serves, so the page and the API can't
  // drift. This view keeps the page's stat labels (dpg, wr, ...) and columns.
  const items = (await getTankDataset(region)).map(
    ({ identity: i, stats: s, specs, mastery, moe }) => ({
      tankId: i.tankId,
      slug: i.slug,
      name: i.name,
      shortName: i.shortName,
      tag: i.tag,
      tier: i.tier,
      nation: i.nation,
      type: i.type,
      role: i.role,
      isPremium: i.isPremium,
      isReward: i.isReward,
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
      specs,
      mastery,
      moe,
    }),
  );

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
