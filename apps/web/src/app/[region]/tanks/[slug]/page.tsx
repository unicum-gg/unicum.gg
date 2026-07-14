import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { TankView } from "@/components/tanks/tank-view";
import { JsonLd } from "@/components/json-ld";
import { constructMetadata } from "@/lib/metadata";
import { breadcrumbSchema, tankSchema } from "@/lib/schema-org";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { getAllTankSpecs } from "@unicum.gg/core/wargaming/wot/tanks/specs";
import { getTankMomByRegion } from "@unicum.gg/core/mom";
import { getTankMoeByRegion } from "@unicum.gg/core/moe";
import { getResearchPath } from "@unicum.gg/core/wargaming/wot/tanks/research-path";
import {
  getMomHistory,
  getMoeHistory,
} from "@/services/tanks/marks-history";
import {
  getTankStats,
  getTopPlayersByTankAllMetrics,
} from "@unicum.gg/core/wargaming/wot/players/top/by-tank";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import { type Region, isRegion } from "@unicum.gg/wargaming";
import { toRoman } from "roman-numerals";

const TOP_LIMIT = 25;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}): Promise<Metadata> {
  const { region, slug } = await params;
  if (!isRegion(region)) return {};
  const tank = await getTankBySlug(region, slug);
  if (!tank) return {};
  const { meta } = tank;
  const regionLabel = region.toUpperCase();
  const tier = meta.tier ? toRoman(meta.tier) : String(meta.tier);
  return constructMetadata({
    title: `${meta.name} World of Tanks stats (${regionLabel}), tier ${tier} ${meta.nation.toUpperCase()}`,
    description: `${meta.name} (${regionLabel}) World of Tanks stats: the best players on this tier ${tier} ${meta.nation.toUpperCase()} tank ranked by WN7, WN8 and WNX, plus expected values.`,
    // Point at the readable slug so a legacy numeric-id URL doesn't become the
    // canonical.
    canonical: ROUTES.TANK(region, tank.slug),
    ogImage: false,
  });
}

export default async function TankPage({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}) {
  const { region, slug } = await params;
  if (!isRegion(region)) notFound();
  return renderTankPage(region, slug);
}

export async function renderTankPage(region: Region, slug: string) {
  const tank = await getTankBySlug(region, slug);
  if (!tank) notFound();
  // Send legacy numeric-id (or wrong-case) URLs to the readable canonical slug
  // with a 308 so links, history, and search engines settle on one URL.
  if (slug !== tank.slug) permanentRedirect(ROUTES.TANK(region, tank.slug));
  const { tankId, meta, slug: canonicalSlug } = tank;

  const [
    topByMetric,
    serverStats,
    wn8Map,
    wnxMap,
    specsMap,
    moeMap,
    momMap,
    researchPath,
    moeHistory,
    momHistory,
  ] = await Promise.all([
    getTopPlayersByTankAllMetrics(region, tankId, TOP_LIMIT),
    getTankStats(region, tankId),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
    getAllTankSpecs(),
    getTankMoeByRegion(region),
    getTankMomByRegion(region),
    getResearchPath(region, tankId),
    getMoeHistory(region, tankId),
    getMomHistory(region, tankId),
  ]);

  const regionLabel = region.toUpperCase();
  const tierLabel = meta.tier ? toRoman(meta.tier) : String(meta.tier);
  const tankUrl = `${APP.URL}${ROUTES.TANK(region, canonicalSlug)}`;

  return (
    <>
      <JsonLd
        data={tankSchema({
          name: meta.name,
          url: tankUrl,
          description: `${meta.name}, tier ${tierLabel} ${meta.nation.toUpperCase()} in World of Tanks. Server-average stats, best players and WN8/WNX expected values on ${regionLabel}.`,
          image: meta.bigIcon,
          tier: meta.tier,
          nation: meta.nation,
          type: meta.type,
          isPremium: meta.isPremium,
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, url: `${APP.URL}${ROUTES.HOME(region)}` },
          { name: "Tanks", url: `${APP.URL}${ROUTES.TANKS(region)}` },
          { name: meta.name, url: tankUrl },
        ])}
      />
      <TankView
        region={region}
        tankId={tankId}
        slug={canonicalSlug}
        meta={meta}
        topByMetric={topByMetric}
        serverStats={serverStats}
        wn8Expected={wn8Map.get(tankId) ?? null}
        wnxExpected={wnxMap.get(tankId) ?? null}
        specs={specsMap.get(tankId) ?? null}
        moe={moeMap.get(tankId) ?? null}
        mom={momMap.get(tankId) ?? null}
        researchPath={researchPath}
        moeHistory={moeHistory}
        momHistory={momHistory}
      />
    </>
  );
}
