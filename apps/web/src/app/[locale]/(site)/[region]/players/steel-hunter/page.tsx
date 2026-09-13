import type { Metadata } from "next";
import { localizePath } from "@/lib/translations";
import { notFound, redirect } from "next/navigation";
import { SteelHunterView } from "@/components/players/list/steel-hunter/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";

export const dynamic = "force-static";
export const revalidate = 1800;

export function generateStaticParams() {
  // EU lives at /players/steel-hunter; only NA and ASIA are enumerated here.
  return [{ region: Region.NA }, { region: Region.ASIA }];
}

/**
 * This section's own metadata, shared by three routes: the regional page, the
 * EU shortcut at its region-less address, and the `/page/[n]` the proxy sends
 * `?page=` to. The last one rewrites every address this declares, so a
 * paginated page cannot drift from the section it is a page of.
 */
export async function steelHunterMetadata(
  region: Region,
  locale: string,
): Promise<Metadata> {
  const label = REGION_LABEL[region];
  const { t } = await getTranslation("app/players/steel-hunter/page", locale);
  const { t: tGame } = await getTranslation("game/vocabulary", locale);
  const mode = tGame("player-modes.steel-hunter");
  return constructMetadata({
    locale,
    title: t("title", { region: label, mode }),
    description: t("description", { name: APP.NAME, region: label, mode }),
    ogTitle: t("og-title", { mode }),
    ogSubtitle: t("og-subtitle", { region: label }),
    canonical: ROUTES.PLAYERS_STEEL_HUNTER(region),
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}): Promise<Metadata> {
  const { locale, region } = await params;
  if (!isRegion(region)) return {};
  return steelHunterMetadata(region, locale);
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}) {
  const { locale, region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) redirect(localizePath(ROUTES.PLAYERS_STEEL_HUNTER(Region.EU), locale));
  return <SteelHunterView locale={locale} region={region} page={1} />;
}
