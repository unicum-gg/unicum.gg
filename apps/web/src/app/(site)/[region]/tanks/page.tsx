import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TanksIndex } from "@/components/tanks/list";
import { tankTabCopy } from "@/components/tanks/list/copy";
import {
  TankGroup,
  buildMasteryItems,
  buildMoeItems,
  buildSpecItems,
  buildStatsItems,
  groupForTab,
  type TankListItem,
} from "@/components/tanks/list/build";
import { TankTab, tankTabHref } from "@/components/tanks/list/tabs";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { buildSafe, unicum } from "@/services/sdk";
import { Region, isRegion } from "@unicum.gg/wargaming";

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

export async function tanksIndexMetadata(
  region: string,
  tab: TankTab,
): Promise<Metadata> {
  if (!isRegion(region)) return {};
  const { title, description } = tankTabCopy(tab, region.toUpperCase());
  return constructMetadata({
    title,
    description,
    ogImage: false,
    // Static (ISR) page: canonical must be explicit, since generateCanonical()
    // reads headers() which isn't available during static generation. Points at
    // this tab's own segment so the five don't compete.
    canonical: tankTabHref(ROUTES.TANKS(region), tab),
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  return tanksIndexMetadata(region, TankTab.Performances);
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

  // The heading lives inside TanksIndex rather than here: switching tab is a
  // client-side pushState (it preserves the shared filters), so a server-rendered
  // heading would keep describing the tab the page was loaded with.
  return (
    <TanksIndex
      tanks={items}
      region={region}
      activeTab={activeTab}
      basePath={ROUTES.TANKS(region)}
    />
  );
}
