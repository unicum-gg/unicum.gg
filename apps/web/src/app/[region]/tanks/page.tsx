import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Panel,
  PanelContent,
  PanelSeparator,
} from "@/components/panel";
import { TanksIndex } from "@/components/tanks/list";
import {
  TankGroup,
  buildMasteryItems,
  buildMoeItems,
  buildSpecItems,
  buildStatsItems,
  groupForTab,
  type TankListItem,
} from "@/components/tanks/list/build";
import { TankTab } from "@/components/tanks/list/tabs";
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
    // Static (ISR) page: canonical must be explicit, since generateCanonical()
    // reads headers() which isn't available during static generation.
    canonical: ROUTES.TANKS(region),
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
  // Only the active tab's data group is fetched + embedded here; the client lazy-
  // loads the other tabs on demand (see components/tanks/list/load-group). This
  // keeps the initial payload to one group instead of all five (~5x smaller) and
  // means a cold ISR revalidation fetches 1-2 endpoints, not 5. The shared
  // builders (list/build) produce the exact same rows the client would.
  const api = unicum.region(region).tanks;
  const EMPTY = { results: [] };
  const group = groupForTab(activeTab);
  let items: TankListItem[];
  if (group === TankGroup.Specs) {
    const [specifications, economics] = await Promise.all([
      buildSafe(() => api.specifications(), EMPTY),
      buildSafe(() => api.economics(), EMPTY),
    ]);
    items = buildSpecItems(
      specifications.results as Parameters<typeof buildSpecItems>[0],
      economics.results as Parameters<typeof buildSpecItems>[1],
    );
  } else if (group === TankGroup.Moe) {
    const moe = await buildSafe(() => api.marksOfExcellence(), EMPTY);
    items = buildMoeItems(moe.results as Parameters<typeof buildMoeItems>[0]);
  } else if (group === TankGroup.Mastery) {
    const mastery = await buildSafe(() => api.marksOfMastery(), EMPTY);
    items = buildMasteryItems(
      mastery.results as Parameters<typeof buildMasteryItems>[0],
    );
  } else {
    const perf = await buildSafe(() => api.list(), EMPTY);
    items = buildStatsItems(perf.results as Parameters<typeof buildStatsItems>[0]);
  }

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
