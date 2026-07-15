import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Panel,
  PanelContent,
  PanelSeparator,
} from "@/components/panel";
import { TanksIndex } from "@/components/tanks/tanks-index";
import type { TankSpecRow } from "@/components/tanks/spec-columns";
import type { MasteryRow, MoeRow } from "@/components/tanks/tanks-index";
import { TankTab } from "@/components/tanks/tabs";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { buildSafe, unicum } from "@/services/sdk";
import {
  Region,
  isRegion,
  REGION_EMOJI,
  REGION_LABEL,
} from "@unicum.gg/wargaming";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// ISR like the other landings: served as prerendered HTML, revalidated in the
// background. The active tab and filters are read client-side from the URL
// (TanksIndex + useTankFilters sync them from the query string), so the page
// never needs searchParams and can be static.
export const dynamic = "force-static";
export const revalidate = 600;

export function generateStaticParams() {
  // EU lives at /tanks (handled by app/tanks/page.tsx), so only NA and ASIA are
  // enumerated here. Exposing the params also lets next-sitemap pick the routes
  // up at build time.
  return [{ region: Region.NA }, { region: Region.ASIA }];
}

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
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  return renderTanksIndex(region);
}

export async function renderTanksIndex(
  region: Region,
  activeTab: TankTab = TankTab.Performances,
) {
  // The page consumes its own public API through the SDK: the five bulk tank
  // endpoints (performance, specifications, economics, MoE, MoM), zipped back
  // together by slug. This view keeps the page's stat labels (dpg, wr, ...)
  // and columns.
  const api = unicum.region(region).tanks;
  const EMPTY = { results: [] };
  const [perf, specifications, economics, marksOfExcellence, marksOfMastery] =
    await Promise.all([
      buildSafe(() => api.list(), EMPTY),
      buildSafe(() => api.specifications(), EMPTY),
      buildSafe(() => api.economics(), EMPTY),
      buildSafe(() => api.marksOfExcellence(), EMPTY),
      buildSafe(() => api.marksOfMastery(), EMPTY),
    ]);
  const specBySlug = new Map(
    specifications.results.map((r) => [r.identity.slug, r.specifications]),
  );
  const econBySlug = new Map(
    economics.results.map((r) => [r.identity.slug, r.economics]),
  );
  const moeBySlug = new Map(
    marksOfExcellence.results.map((r) => [r.identity.slug, r.moe]),
  );
  const masteryBySlug = new Map(
    marksOfMastery.results.map((r) => [r.identity.slug, r.mastery]),
  );

  const items = perf.results.map(({ identity: i, stats: s }) => {
    // The page's spec columns span both the specifications and the economics
    // projections of the same underlying spec row; merge them back.
    const spec = specBySlug.get(i.slug) ?? null;
    const econ = econBySlug.get(i.slug) ?? null;
    return {
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
      specs: (spec || econ ? { ...spec, ...econ } : null) as TankSpecRow | null,
      mastery: (masteryBySlug.get(i.slug) ?? null) as MasteryRow | null,
      moe: (moeBySlug.get(i.slug) ?? null) as MoeRow | null,
    };
  });

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
