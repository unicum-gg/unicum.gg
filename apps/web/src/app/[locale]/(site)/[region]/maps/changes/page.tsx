import type { Metadata } from "next";
import { localizePath } from "@/lib/translations";
import { notFound, redirect } from "next/navigation";
import { MapChangesView } from "@/components/maps/list/changes/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";

// ISR like the other map landings: prerendered, revalidated in the background.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

/**
 * This section's own metadata, shared by three routes: the regional page, the
 * EU shortcut at its region-less address, and the `/page/[n]` the proxy sends
 * `?page=` to. The last one rewrites every address this declares, so a
 * paginated page cannot drift from the section it is a page of.
 */
export async function mapChangesMetadata(
  region: Region,
  locale: string,
): Promise<Metadata> {
  const label = REGION_LABEL[region];
  const { t } = await getTranslation("app/maps/changes/page", locale);
  return constructMetadata({
    locale,
    title: t("title", { region: label }),
    description: t("description", { name: APP.NAME, region: label }),
    canonical: ROUTES.MAPS_CHANGES(region),
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}): Promise<Metadata> {
  const { locale, region } = await params;
  if (!isRegion(region)) return {};
  return mapChangesMetadata(region, locale);
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}) {
  const { locale, region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) redirect(localizePath(ROUTES.MAPS_CHANGES(Region.EU), locale));
  return <MapChangesView locale={locale} region={region} page={1} />;
}
