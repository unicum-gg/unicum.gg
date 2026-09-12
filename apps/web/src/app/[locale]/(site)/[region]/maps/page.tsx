import { Interpolate } from "@/components/interpolate";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { MapSummary } from "@unicum.gg/shared";
import {
  Region,
  isRegion,
  REGION_EMOJI,
  REGION_LABEL,
} from "@unicum.gg/wargaming";
import { MapsGallery } from "@/components/maps/list";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { mapsTabCopy } from "@/components/maps/list/copy";
import {
  BATTLE_ALL,
  type BattleTab,
  mapsTabHref,
} from "@/components/maps/list/tabs";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { buildSafe, unicum } from "@/services/sdk";

// ISR like the other landings: prerendered HTML, revalidated in the background.
// The search + filters are read client-side (MapsGallery), so the page needs no
// searchParams and stays static.
export const dynamic = "force-static";
export const revalidate = 3600;

export function generateStaticParams() {
  // EU lives at /maps (app/(site)/maps), so only NA and ASIA are enumerated.
  return [{ region: Region.NA }, { region: Region.ASIA }];
}

export async function mapsIndexMetadata(
  region: string,
  tab: BattleTab,
  locale: string,
): Promise<Metadata> {
  if (!isRegion(region)) return {};
  const regionLabel = region.toUpperCase();
  const { t } = await getTranslation("components/maps/list/copy", locale);
  const { t: tGame } = await getTranslation("game/vocabulary", locale);
  const copy = mapsTabCopy(tab, t, tGame);
  return constructMetadata({
    locale,
    title: copy.title(regionLabel),
    description: copy.description(regionLabel),
    ogImage: false,
    // Points at this tab's own segment so the battle types don't compete.
    canonical: mapsTabHref(ROUTES.MAPS(region), tab),
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}): Promise<Metadata> {
  const { locale, region } = await params;
  return mapsIndexMetadata(region, BATTLE_ALL, locale);
}

export default async function MapsIndexPage({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}) {
  const { locale, region } = await params;
  if (!isRegion(region)) notFound();
  return renderMapsIndex(region, locale);
}

export async function renderMapsIndex(
  region: Region,
  locale: string,
  activeTab: BattleTab = BATTLE_ALL,
) {
  const { results } = await buildSafe(
    () => unicum.region(region).maps.list(),
    { results: [] as MapSummary[] },
  );
  const maps = results as MapSummary[];

  const { t } = await getTranslation("components/maps/list/copy", locale);
  const { t: tGame } = await getTranslation("game/vocabulary", locale);
  const copy = mapsTabCopy(activeTab, t, tGame);
  const shown =
    activeTab === BATTLE_ALL
      ? maps.length
      : maps.filter((m) => m.battleTypes.includes(activeTab)).length;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            <Interpolate
              template={copy.heading}
              wrap={{
                accent: (text) => <span className="text-brand">{text}</span>,
              }}
            />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {copy.intro(shown, REGION_LABEL[region])}
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <MapsGallery
        maps={maps}
        region={region}
        activeTab={activeTab}
        basePath={ROUTES.MAPS(region)}
      />
    </div>
  );
}
