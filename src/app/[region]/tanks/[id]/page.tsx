import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import {
  type SimilarTank,
  TankDetailView,
} from "@/components/tanks/tank-detail-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { breadcrumbSchema, tankSchema } from "@/lib/schema-org";
import { listTankCommunityStats } from "@/services/tanks/aggregates";
import { nationLabel, typeLabel } from "@/services/tanks/labels";
import { getVehicleEncyclopedia } from "@/services/wargaming/wot/encyclopedia";
import {
  isRegion,
  REGION_LABEL,
} from "@/services/wargaming/wot";

const SIMILAR_LIMIT = 14;
const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function parseTankId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; id: string }>;
}): Promise<Metadata> {
  const { region, id } = await params;
  if (!isRegion(region)) return {};
  const tankId = parseTankId(id);
  if (tankId === null) return {};
  const encyclopedia = await getVehicleEncyclopedia(region);
  const meta = encyclopedia[String(tankId)];
  if (!meta) return {};

  const label = REGION_LABEL[region];
  const klass = typeLabel(meta.type);
  return constructMetadata({
    title: `${meta.name} World of Tanks stats (${label})`,
    description: `${meta.name}, Tier ${meta.tier} ${nationLabel(meta.nation)} ${klass} in World of Tanks: community win rate, average damage and popularity on ${label}, aggregated by ${APP.NAME}.`,
    ogTitle: meta.name,
    ogSubtitle: `Tier ${meta.tier} ${klass} (${label})`,
    canonical: ROUTES.TANK(region, tankId),
  });
}

export default async function TankDetailPage({
  params,
}: {
  params: Promise<{ region: string; id: string }>;
}) {
  const { region, id } = await params;
  if (!isRegion(region)) notFound();
  const tankId = parseTankId(id);
  if (tankId === null) notFound();

  const [encyclopedia, statsMap] = await Promise.all([
    getVehicleEncyclopedia(region),
    listTankCommunityStats(region),
  ]);
  const meta = encyclopedia[String(tankId)];
  if (!meta) notFound();
  const stats = statsMap.get(tankId) ?? null;

  const similar: SimilarTank[] = Object.entries(encyclopedia)
    .map(([sid, m]) => ({ tankId: Number(sid), meta: m }))
    .filter(
      (t) =>
        t.tankId !== tankId &&
        t.meta.tier === meta.tier &&
        t.meta.type === meta.type &&
        !!t.meta.name,
    )
    .sort(
      (a, b) =>
        (statsMap.get(b.tankId)?.players ?? 0) -
          (statsMap.get(a.tankId)?.players ?? 0) ||
        a.meta.name.localeCompare(b.meta.name),
    )
    .slice(0, SIMILAR_LIMIT);

  const label = REGION_LABEL[region];
  const klass = typeLabel(meta.type);
  const url = `${APP.URL}${ROUTES.TANK(region, tankId)}`;
  const wr = stats?.avgWinrate ?? null;
  const description =
    stats && wr !== null
      ? `${meta.name} on ${label}: ${pctFmt.format(wr * 100)}% community win rate and ${intFmt.format(stats.avgDamage ?? 0)} average damage across ${intFmt.format(stats.players)} tracked players.`
      : `${meta.name}, a Tier ${meta.tier} ${nationLabel(meta.nation)} ${klass} in World of Tanks (${label}).`;

  return (
    <>
      <JsonLd
        data={tankSchema({
          name: meta.name,
          url,
          description,
          nation: nationLabel(meta.nation),
          category: klass,
          tier: meta.tier,
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, path: "/" },
          { name: `Tanks (${label})`, path: ROUTES.TANKS(region) },
          { name: meta.name, path: ROUTES.TANK(region, tankId) },
        ])}
      />
      <TankDetailView
        region={region}
        meta={meta}
        stats={stats}
        similar={similar}
      />
    </>
  );
}

// On-demand ISR: the per-tank page renders SSR on first crawl and is cached
// for a day. We deliberately skip generateStaticParams (which would prerender
// ~700 tanks x 3 regions at build time and stretch the build) since aggregates
// only change nightly and the first-hit render is cheap (two small reads).
export const revalidate = 86400;
