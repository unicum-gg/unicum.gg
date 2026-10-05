import type { Metadata } from "next";
import { MarksLandingView } from "@/components/players/list/marks/view";
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
  const name = languageDisplayName(language, locale);
  const label = REGION_LABEL[Region.EU];
  const { t } = await getTranslation("app/players/marks/lang/page", locale);
  const { t: tGame } = await getTranslation("game/vocabulary", locale);
  const marks = tGame("marks.3");
  return constructMetadata({
    locale,
    title: t("title", { language: name, region: label, marks }),
    description: t("description", {
      name: APP.NAME,
      region: label,
      language: name,
      marks,
    }),
    ogTitle: t("og-title", { language: name, marks }),
    ogSubtitle: t("og-subtitle", { region: label }),
    canonical: ROUTES.PLAYERS_MARKS_BY_LANGUAGE(Region.EU, language),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; language: string }>;
}) {
  const { locale, language } = await params;
  return (
    <MarksLandingView
      locale={locale}
      region={Region.EU}
      language={language}
      strict={false}
    />
  );
}

export const dynamic = "force-static";
export const revalidate = 1800;
