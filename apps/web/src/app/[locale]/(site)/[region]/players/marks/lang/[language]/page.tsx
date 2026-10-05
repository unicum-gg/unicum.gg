import type { Metadata } from "next";
import { localizePath } from "@/lib/translations";
import { notFound, redirect } from "next/navigation";
import { MarksLandingView } from "@/components/players/list/marks/view";
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
    canonical: ROUTES.PLAYERS_MARKS_BY_LANGUAGE(region, language),
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
    redirect(
      localizePath(
        ROUTES.PLAYERS_MARKS_BY_LANGUAGE(Region.EU, language),
        locale,
      ),
    );
  }
  // No `page`: a per-language view has no `/page/[n]` route of its own, so the
  // board keeps its buttons and nothing links a crawler at a page the server
  // would answer with the first one. Thirty-six languages times three regions
  // times ten pages is not a thing to put in the ISR cache.
  return (
    <MarksLandingView
      locale={locale}
      region={region}
      language={language}
      strict={false}
    />
  );
}

// ISR: prerendered on demand and revalidated in the background, so the build
// never depends on a running API and a language nobody reads costs nothing.
export const dynamic = "force-static";
export const revalidate = 1800;
