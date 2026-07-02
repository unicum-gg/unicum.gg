import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ClanHeader } from "@/components/clans/header";
import { ClanTab, tabFromQuery } from "@/components/clans/tabs";
import { ClanTabsView } from "@/components/clans/tabs-view";
import { ViewBeacon } from "@/components/view-beacon";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { JsonLd } from "@/components/json-ld";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { PerfTrace, currentTrace, runWithTrace } from "@/lib/perf-trace";
import { clanSchema } from "@/lib/schema-org";
import { loadClanDetail } from "@/services/clans/detail";
import { getClanByTagCached } from "@/services/clans/repository";
import { getClanTankAggregates } from "@/services/clans/repository/tanks";
import {
  buildClanVehicleRows,
  type ClanVehicleRow,
} from "@/services/clans/vehicles";
import { isRegion, type Region } from "@/services/wargaming/wot";
import { getVehicleEncyclopedia } from "@/services/wargaming/wot/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@/services/wargaming/wot/ratings";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const loadClanByTag = cache(getClanByTagCached);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; tag: string }>;
}): Promise<Metadata> {
  const { region, tag } = await params;
  if (!isRegion(region)) return {};
  const decoded = decodeURIComponent(tag);
  const regionLabel = region.toUpperCase();

  const cached = await loadClanByTag(region, decoded);
  if (!cached) {
    return constructMetadata({
      title: `[${decoded}] World of Tanks clan (${regionLabel})`,
      description: `[${decoded}] World of Tanks clan on ${regionLabel}: members table with WN8/WNX ratings, join/leave activity, recent battles and full clan history.`,
      ogImage: false,
    });
  }
  const clan = cached.info;
  const members = intFmt.format(clan.membersCount);
  return constructMetadata({
    title: `[${clan.tag}] ${clan.name} World of Tanks clan (${regionLabel}), ${members} members`,
    description: `${clan.name} [${clan.tag}] on ${regionLabel}: ${members} members, full members table with WN8 and WNX ratings, recent join/leave activity and clan history.`,
    ogImage: false,
  });
}

export default async function ClanPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string; tag: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { region, tag } = await params;
  if (!isRegion(region)) notFound();
  const decoded = decodeURIComponent(tag);
  const { tab: tabParam } = await searchParams;
  const activeTab = tabFromQuery(tabParam);

  const trace = new PerfTrace(`ClanPage ${region}/${decoded}`);
  try {
    return await runWithTrace(trace, () => render(region, decoded, activeTab));
  } finally {
    trace.endRender();
  }
}

async function render(
  region: Region,
  decoded: string,
  activeTab: ClanTab,
): Promise<React.ReactElement> {
  const trace = currentTrace();
  const span = <T,>(name: string, fn: () => Promise<T>): Promise<T> =>
    trace ? trace.span(name, fn) : fn();

  const clanCached = await span("getClanByTagCached", () =>
    loadClanByTag(region, decoded),
  );
  if (!clanCached) notFound();
  const clan = clanCached.info;
  trace?.log(
    `clan fromDb=${clanCached.fromDb} refreshing=${clanCached.refreshing}`,
  );

  // The three light tabs (Overview, Stronghold, Clan Wars) are always loaded so
  // switching to them is an instant client toggle with no server round-trip.
  // These are all cheap indexed/cached reads. Ratings (wn7/wn8/wnx/wnx30d) are
  // pre-computed and cached on each member row, so the members table renders
  // fully populated on first paint. Same payload the clan detail endpoint
  // serves, so a LiveSync tick can refetch it client-side.
  const detail = await loadClanDetail(region, clan, span);
  const members = detail.members;
  trace?.log(`members count=${members.length}`);

  // Tanks tab: the per-member aggregation is the heavy query on this page, so
  // load it server-side only when Tanks is the tab being rendered (its content
  // then ships in the initial HTML for SEO/deep-links). On any other tab it's
  // left null and fetched on demand — then cached — client-side via SWR.
  let initialVehicles: ClanVehicleRow[] | null = null;
  if (activeTab === ClanTab.Tanks) {
    const [aggregates, encyclopedia, wn8Expected, wnxExpected] =
      await Promise.all([
        span("getClanTankAggregates", () =>
          getClanTankAggregates(region, clan.id),
        ),
        span("getVehicleEncyclopedia", () => getVehicleEncyclopedia(region)),
        span("getWN8ExpectedValues", () => getWN8ExpectedValues()),
        span("getWNXExpectedValues", () => getWNXExpectedValues()),
      ]);
    initialVehicles = buildClanVehicleRows(
      aggregates,
      encyclopedia,
      wn8Expected,
      wnxExpected,
    );
  }

  const basePath = ROUTES.CLAN(region, clan.tag);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <JsonLd
        data={clanSchema({
          tag: clan.tag,
          name: clan.name,
          region: region.toUpperCase(),
          membersCount: clan.membersCount,
          url: `${APP.URL}${ROUTES.CLAN(region, clan.tag)}`,
          description: `${clan.name} [${clan.tag}] World of Tanks clan on ${region.toUpperCase()}: ${clan.membersCount} members, WN8/WNX ratings, member rankings, recent join/leave activity.`,
          logo: clan.emblem,
        })}
      />
      <ViewBeacon
        url={`/api/${region}/clans/${encodeURIComponent(clan.tag)}/enqueue`}
      />
      <Panel>
        <PanelContent className="p-0">
          <ClanHeader region={region} clan={clan} members={members} />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <ClanTabsView
        region={region}
        tag={clan.tag}
        basePath={basePath}
        activeTab={activeTab}
        descriptionHtml={clan.descriptionHtml ?? null}
        initialData={detail}
        initialVehicles={initialVehicles}
      />
    </div>
  );
}
