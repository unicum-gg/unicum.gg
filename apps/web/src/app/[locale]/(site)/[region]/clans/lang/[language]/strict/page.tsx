import type { Metadata } from "next";
import { localizePath } from "@/lib/translations";
import { notFound, redirect } from "next/navigation";
import { ClansLandingView } from "@/components/clans/list/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";
import { languageDisplayName } from "@/lib/language-name";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string; language: string }>;
}): Promise<Metadata> {
  const { locale, region, language } = await params;
  if (!isRegion(region)) return {};
  const name = languageDisplayName(language, locale);
  const label = REGION_LABEL[region];
  const { t } = await getTranslation("app/clans/lang/strict/page", locale);
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
    canonical: ROUTES.CLANS_BY_LANGUAGE(region, language, true),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; region: string; language: string }>;
}) {
  const { locale, region, language } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) {
    redirect(localizePath(ROUTES.CLANS_BY_LANGUAGE(Region.EU, language, true), locale));
  }
  return <ClansLandingView region={region} language={language} locale={locale} strict={true} />;
}

// ISR: served as prerendered HTML and revalidated in the background, so
// navigation stays instant while the data follows the endpoints' cadence.
// Language params are generated on demand (no build-time prerender, so the
// build never depends on a running API) and cached between revalidations.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min, matches the detail pages (board data is materialized hourly)
