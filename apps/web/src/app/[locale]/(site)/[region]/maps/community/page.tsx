import type { Metadata } from "next";
import { localizePath } from "@/lib/translations";
import { notFound, redirect } from "next/navigation";
import { MapCommunityView } from "@/components/maps/list/community/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";

// ISR like the other map landings: prerendered, revalidated in the background.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

/**
 * This section's own metadata, shared by the regional page and the EU shortcut
 * at its region-less address, so the two cannot drift.
 *
 * No `/page/[n]` here, unlike the vehicle board: the random pool is around
 * fifty arenas, so this board is one page and there is nothing to paginate.
 */
export async function mapCommunityMetadata(
  region: Region,
  locale: string,
): Promise<Metadata> {
  const label = REGION_LABEL[region];
  const { t } = await getTranslation("app/maps/community/page", locale);
  return constructMetadata({
    locale,
    title: t("title", { region: label }),
    description: t("description", { name: APP.NAME, region: label }),
    canonical: ROUTES.MAPS_COMMUNITY(region),
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}): Promise<Metadata> {
  const { locale, region } = await params;
  if (!isRegion(region)) return {};
  return mapCommunityMetadata(region, locale);
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}) {
  const { locale, region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU)
    redirect(localizePath(ROUTES.MAPS_COMMUNITY(Region.EU), locale));
  return <MapCommunityView locale={locale} region={region} />;
}
