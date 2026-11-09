import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ManeuversPage } from "@/components/maneuvers";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { isRegion, REGION_LABEL, REGIONS, type Region } from "@unicum.gg/wargaming";

// ISR like the other boards: the page reads no searchParams and no cookie (the
// players/clans switch only chooses which of the two already-rendered boards is
// shown), so it prerenders per region and navigation serves cached HTML.
export const dynamic = "force-static";
// Shorter than the clan boards' 30 minutes: an edition runs for two weeks and
// its cutoff moves during a prime time, which is exactly when somebody reloads.
// The endpoint caches for a minute underneath, so this costs one local hop.
export const revalidate = 300;

export function generateStaticParams() {
  return REGIONS.map((region) => ({ region }));
}

/**
 * Exported so the region-less EU shortcut says exactly what this page says,
 * rather than keeping a second copy of it.
 */
export async function maneuversMetadata(
  region: Region,
  locale: string,
): Promise<Metadata> {
  const { t } = await getTranslation("app/maneuvers/page", locale);
  // The event's name as the reader's own client writes it, so a French title
  // says "Manœuvres" above a page whose heading says the same.
  const { t: tGame } = await getTranslation("game/vocabulary", locale);
  const maneuvers = tGame("battle-formats.maneuvers");
  return constructMetadata({
    locale,
    title: t("title", { maneuvers, region: REGION_LABEL[region] }),
    description: t("description", { maneuvers, region: REGION_LABEL[region] }),
    canonical: ROUTES.MANEUVERS(region),
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}): Promise<Metadata> {
  const { locale, region } = await params;
  if (!isRegion(region)) return {};
  return maneuversMetadata(region, locale);
}

export default async function RegionManeuversPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  return <ManeuversPage region={region} />;
}
