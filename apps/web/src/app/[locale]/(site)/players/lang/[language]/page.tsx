import type { Metadata } from "next";
import { PlayersLandingView } from "@/components/players/list/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";
import { languageDisplayName } from "@/lib/language-name";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; language: string }>;
}): Promise<Metadata> {
  const { locale, language } = await params;
  const { t } = await getTranslation("app/players/lang/page", locale);
  const name = languageDisplayName(language, locale);
  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    locale,
    title: t("title", { language: name, region: label }),
    description: t("description", {
      name: APP.NAME,
      region: label,
      language: name,
    }),
    ogTitle: t("og-title", { language: name }),
    ogSubtitle: t("og-subtitle", { region: label }),
    canonical: ROUTES.PLAYERS_BY_LANGUAGE(Region.EU, language),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; language: string }>;
}) {
  const { locale, language } = await params;
  return (
    <PlayersLandingView locale={locale} region={Region.EU} language={language} strict={false} />
  );
}

// ISR: served as prerendered HTML and revalidated in the background, so
// navigation stays instant while the data follows the endpoints' cadence.
// Language params are generated on demand (no build-time prerender, so the
// build never depends on a running API) and cached between revalidations.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min, matches the detail pages (board data is materialized hourly)
