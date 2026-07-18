import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { TankView } from "@/components/tanks/tank-view";
import { JsonLd } from "@/components/json-ld";
import { constructMetadata } from "@/lib/metadata";
import { breadcrumbSchema, tankSchema } from "@/lib/schema-org";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { unicum } from "@/services/sdk";
import { UnicumError } from "@unicum.gg/sdk";
import type { ResearchBranch } from "@unicum.gg/core/wargaming/wot/tanks/research-path";
import type { TankModuleNode } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import type { TankConfig } from "@unicum.gg/core/wargaming/wot/tanks/configs";
import type { TankSpec } from "@unicum.gg/shared";
import { type Region, isRegion } from "@unicum.gg/wargaming";
import { toRoman } from "roman-numerals";


// Dynamic on purpose: the page consumes our own API through the SDK, and
// prerendering it at build time would make the build depend on a running API.
// The endpoints cache server-side, so per-request cost is local HTTP hops onto
// cached payloads.
export const dynamic = "force-dynamic";

// The page consumes its own public API through the SDK: one composite
// `GET /{region}/tanks/{slug}/detail` payload carries everything the view
// renders. Next memoizes identical fetches within one render pass, so
// generateMetadata and the page body share a single request.
async function loadDetail(region: Region, slug: string) {
  try {
    return await unicum.region(region).tanks(slug).detail();
  } catch (error) {
    if (error instanceof UnicumError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}): Promise<Metadata> {
  const { region, slug } = await params;
  if (!isRegion(region)) return {};
  const detail = await loadDetail(region, slug).catch(() => null);
  if (!detail) return {};
  const { meta } = detail;
  const regionLabel = region.toUpperCase();
  const tier = meta.tier ? toRoman(meta.tier) : String(meta.tier);
  return constructMetadata({
    title: `${meta.name} World of Tanks stats (${regionLabel}), tier ${tier} ${meta.nation.toUpperCase()}`,
    description: `${meta.name} (${regionLabel}) World of Tanks stats: the best players on this tier ${tier} ${meta.nation.toUpperCase()} tank ranked by WN7, WN8 and WNX, plus expected values.`,
    // Point at the readable slug so a legacy numeric-id URL doesn't become the
    // canonical.
    canonical: ROUTES.TANK(region, detail.slug),
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
  const detail = await loadDetail(region, slug);
  if (!detail) notFound();
  // Send legacy numeric-id (or wrong-case) URLs to the readable canonical slug
  // with a 308 so links, history, and search engines settle on one URL.
  if (slug !== detail.slug) permanentRedirect(ROUTES.TANK(region, detail.slug));
  const { tankId, meta, slug: canonicalSlug } = detail;

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
        topByMetric={detail.topByMetric}
        serverStats={detail.serverStats}
        wn8Expected={detail.wn8Expected}
        wnxExpected={detail.wnxExpected}
        specs={detail.specs as unknown as TankSpec | null}
        moe={detail.moe}
        mom={detail.mom}
        researchPath={detail.researchPath as unknown as ResearchBranch}
        modules={detail.modules as unknown as TankModuleNode[]}
        configs={detail.configs as unknown as TankConfig[]}
        moeHistory={detail.moeHistory}
        momHistory={detail.momHistory}
      />
    </>
  );
}
