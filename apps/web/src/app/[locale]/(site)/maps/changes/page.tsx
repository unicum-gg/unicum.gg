import type { Metadata } from "next";
import { MapChangesView } from "@/components/maps/list/changes/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";

// EU shortcut: /maps/changes renders the same feed as /eu/maps/changes.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await getTranslation("app/maps/changes/page", locale);

  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    locale,
    title: t("title", { region: label }),
    description: t("description", { name: APP.NAME, region: label }),
    canonical: ROUTES.MAPS_CHANGES(Region.EU),
  });
}

export default async function MapChangesPageEU({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <MapChangesView locale={locale} region={Region.EU} />;
}
