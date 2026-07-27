import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { TankView } from "@/components/tanks/detail/view";
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
import type { TankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import type { TankCrew } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import type { TankFieldMods } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import type { TankSkillTree } from "@unicum.gg/core/wargaming/wot/tanks/skill-tree";
import type { TankSpec } from "@unicum.gg/shared";
import { type Region, isRegion } from "@unicum.gg/wargaming";
import { toRoman } from "roman-numerals";


// ISR, not dynamic: every tab's content is rendered here and the whole page is
// cached, so a navigation serves prerendered HTML instead of re-running the
// heavy tank-view render each time (measured 0.3-4.4s/nav while force-dynamic,
// vs ~50ms for the static pages). The active tab lives in `?tab=` and is swapped
// entirely client-side (see tab-bar), so this page reads no searchParams and
// stays static. On-demand: pages generate on first request (no
// generateStaticParams for the ~1229 slugs) and revalidate on the tank data's
// daily cadence. The SDK loopback covers any build-time prerender.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

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
    ogImage: `/api/og/${region}/tanks/${encodeURIComponent(detail.slug)}`,
  });
}

export default async function TankPage({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}) {
  const { region, slug } = await params;
  if (!isRegion(region)) notFound();
  // The active tab lives in `?tab=` and is read client-side by the tab-bar, so
  // the server render is tab-agnostic and reads no searchParams (stays static).
  return renderTankPage(region, slug);
}

// Renders the tank view inline (blocking on the detail fetch) rather than
// streaming it behind a Suspense skeleton: force-static prerenders the whole
// page, so the real stats land in the cached HTML. That keeps the `.md` twin and
// non-JS crawlers complete (a Suspense boundary would leave only the skeleton in
// `#page-content`). The redirect/notFound run here in the blocking render.
export function renderTankPage(region: Region, slug: string) {
  return <TankPageServer region={region} slug={slug} />;
}

async function TankPageServer({
  region,
  slug,
}: {
  region: Region;
  slug: string;
}) {
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
        loadout={detail.loadout as unknown as TankLoadout | null}
        crew={detail.crew as unknown as TankCrew | null}
        fieldMods={detail.fieldMods as unknown as TankFieldMods | null}
        skillTree={detail.skillTree as unknown as TankSkillTree | null}
        moeHistory={detail.moeHistory}
        momHistory={detail.momHistory}
      />
    </>
  );
}
