import type { Metadata } from "next";
import { ClansLandingView } from "@/components/clans/list/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";


// ISR: served as prerendered HTML and revalidated in the background, so
// navigation stays instant while the data follows the endpoints' cadence.
// The SDK calls fail-soft to an empty shell at build time (a build must not
// depend on a running API); the first revalidation after deploy fills it in.
export const dynamic = "force-static";
export const revalidate = 3600; // 1h: matches the hourly-materialized board data (1800 regenerated twice per data cycle for nothing)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await getTranslation("app/clans/page", locale);

  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    locale,
    title: t("title", { region: label }),
    description: t("description", { name: APP.NAME, region: label }),
    ogTitle: t("og-title"),
    ogSubtitle: t("og-subtitle", { region: label }),
    canonical: ROUTES.CLANS(Region.EU),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <ClansLandingView region={Region.EU} language={null} locale={locale} />
  );
}

