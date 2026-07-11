import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ClanHeader } from "@/components/clans/header";
import {
  type ClanMode,
  ClanSection,
  modeFromQuery,
  sectionFromQuery,
} from "@/components/clans/tabs";
import { ClanTabsView } from "@/components/clans/tabs-view";
import { ViewBeacon } from "@/components/view-beacon";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { JsonLd } from "@/components/json-ld";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { PerfTrace, currentTrace, runWithTrace } from "@unicum.gg/core/lib/perf-trace";
import { clanSchema } from "@/lib/schema-org";
import { loadClanDetail } from "@/services/clans/detail";
import { getClanByTagCached } from "@unicum.gg/core/clans/repository";
import { getClanTankAggregates } from "@unicum.gg/core/clans/repository/tanks";
import {
  buildClanVehicleRows,
  type ClanVehicleRow,
} from "@unicum.gg/core/clans/vehicles";
import { isRegion, type Region } from "@unicum.gg/wargaming/region";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import {
} from "@unicum.gg/core/wargaming/wot/ratings";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";

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
  searchParams: Promise<{ tab?: string; section?: string }>;
}) {
  const { region, tag } = await params;
  if (!isRegion(region)) notFound();
  const decoded = decodeURIComponent(tag);
  const { tab: tabParam, section: sectionParam } = await searchParams;
  // Two independent nav axes, each its own query param (see components/clans/tabs).
  const active: ActiveTab = {
    section: sectionFromQuery(sectionParam),
    mode: modeFromQuery(tabParam),
  };

  const trace = new PerfTrace(`ClanPage ${region}/${decoded}`);
  try {
    return await runWithTrace(trace, () => render(region, decoded, active));
  } finally {
    trace.endRender();
  }
}

type ActiveTab = { section: ClanSection; mode: ClanMode };

async function render(
  region: Region,
  decoded: string,
  active: ActiveTab,
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

  // The Overview modes (Random Battles, Stronghold, Clan Wars) are always
  // loaded so switching between them is an instant client toggle with no server
  // round-trip. These are all cheap indexed/cached reads. Ratings
  // (wn7/wn8/wnx/wnx30d) are pre-computed and cached on each member row, so the
  // members table renders fully populated on first paint. Same payload the clan
  // detail endpoint serves, so a LiveSync tick can refetch it client-side.
  const detail = await loadClanDetail(region, clan, span);
  const members = detail.members;
  trace?.log(`members count=${members.length}`);

  // Tanks section: the per-member aggregation is the heavy query on this page,
  // so load it server-side only when Tanks is the section being rendered (its
  // content then ships in the initial HTML for SEO/deep-links). On any other
  // section it's left null and fetched on demand — then cached — client-side
  // via SWR.
  let initialVehicles: ClanVehicleRow[] | null = null;
  if (active.section === ClanSection.Tanks) {
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
        color={clan.color}
        basePath={basePath}
        activeSection={active.section}
        activeMode={active.mode}
        descriptionHtml={clan.descriptionHtml ?? null}
        initialData={detail}
        initialVehicles={initialVehicles}
      />
    </div>
  );
}
