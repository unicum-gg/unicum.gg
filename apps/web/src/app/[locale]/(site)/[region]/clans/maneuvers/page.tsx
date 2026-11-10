import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ManeuversClansView } from "@/components/clans/list/maneuvers/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { localizePath } from "@/lib/translations";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";
import { withDictionaries } from "@/components/dictionaries";

// ISR like the player half; same reasoning for the 5-minute window.
export const dynamic = "force-static";
export const revalidate = 300;

/**
 * This section's own metadata, shared by the regional page and the EU shortcut
 * at its region-less address.
 */
export async function maneuversClansMetadata(
  region: Region,
  locale: string,
): Promise<Metadata> {
  const label = REGION_LABEL[region];
  const { t } = await getTranslation("app/clans/maneuvers/page", locale);
  const { t: tGame } = await getTranslation("game/vocabulary", locale);
  const maneuvers = tGame("battle-formats.maneuvers");
  return constructMetadata({
    locale,
    title: t("title", { maneuvers, region: label }),
    description: t("description", { name: APP.NAME, maneuvers, region: label }),
    canonical: ROUTES.CLANS_MANEUVERS(region),
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}): Promise<Metadata> {
  const { locale, region } = await params;
  if (!isRegion(region)) return {};
  return maneuversClansMetadata(region, locale);
}

async function Page({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}) {
  const { locale, region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU)
    redirect(localizePath(ROUTES.CLANS_MANEUVERS(Region.EU), locale));
  return <ManeuversClansView locale={locale} region={region} />;
}

export default withDictionaries(
  "[locale]/(site)/[region]/clans/maneuvers",
  Page,
);
