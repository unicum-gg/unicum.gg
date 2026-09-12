import type { Metadata } from "next";
import { SteelHunterView } from "@/components/players/list/steel-hunter/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";

// ISR, like the WNX landing: prerendered HTML revalidated in the background so
// navigation stays instant while the board follows the cron's cadence.
export const dynamic = "force-static";
export const revalidate = 1800;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await getTranslation("app/players/steel-hunter/page", locale);
  const { t: tGame } = await getTranslation("game/vocabulary", locale);

  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    locale,
    title: t("title", { region: label, mode: tGame("player-modes.steel-hunter") }),
    description: t("description", { name: APP.NAME, region: label }),
    ogTitle: t("og-title", { mode: tGame("player-modes.steel-hunter") }),
    ogSubtitle: t("og-subtitle", { region: label }),
    canonical: ROUTES.PLAYERS_STEEL_HUNTER(Region.EU),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SteelHunterView locale={locale} region={Region.EU} />;
}
