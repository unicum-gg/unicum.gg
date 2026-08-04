import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { MapSummary } from "@unicum.gg/shared";
import {
  Region,
  REGION_EMOJI,
  REGION_LABEL,
  isRegion,
} from "@unicum.gg/wargaming";
import { MapsGallery } from "@/components/maps/list";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  if (!isRegion(region)) return {};
  const regionLabel = region.toUpperCase();
  return constructMetadata({
    title: `All World of Tanks maps (${regionLabel}), every battle arena`,
    description: `Browse every World of Tanks map on ${regionLabel}: minimaps, size, camouflage and supported game modes, with per-mode base flags and spawn points.`,
    ogImage: false,
    canonical: ROUTES.MAPS(region),
  });
}

export default async function MapsIndexPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  return renderMapsIndex(region);
}

export async function renderMapsIndex(region: Region) {
  const { results } = await buildSafe(
    () => unicum.region(region).maps.list(),
    { results: [] as MapSummary[] },
  );
  const maps = results as MapSummary[];

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            All <span className="text-brand">maps</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            Every one of the {maps.length} World of Tanks battle arenas. Filter
            by camouflage and game mode, then open a map for its minimap, size
            and per-mode base flags and spawn points.
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <MapsGallery maps={maps} region={region} />
      </Panel>
    </div>
  );
}
