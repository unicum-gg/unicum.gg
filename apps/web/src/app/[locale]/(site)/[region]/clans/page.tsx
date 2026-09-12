import type { Metadata } from "next";
import { localizePath } from "@/lib/translations";
import { notFound, redirect } from "next/navigation";
import { ClansLandingView } from "@/components/clans/list/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";


// ISR: served as prerendered HTML and revalidated in the background, so
// navigation stays instant while the data follows the endpoints' cadence.
// The SDK calls fail-soft to an empty shell at build time (a build must not
// depend on a running API); the first revalidation after deploy fills it in.
export const dynamic = "force-static";
export const revalidate = 3600; // 1h: matches the hourly-materialized board data (1800 regenerated twice per data cycle for nothing)

export function generateStaticParams() {
  // EU lives at /clans (handled by app/clans/page.tsx + a redirect from
  // /eu/clans), so only NA and ASIA are enumerated here. Exposing the
  // params also lets next-sitemap pick the routes up at build time.
  return [{ region: Region.NA }, { region: Region.ASIA }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}): Promise<Metadata> {
  const { locale, region } = await params;
  if (!isRegion(region)) return {};
  const label = REGION_LABEL[region];
  const { t } = await getTranslation("app/clans/page", locale);
  return constructMetadata({
    locale,
    title: t("title", { region: label }),
    description: t("description", { name: APP.NAME, region: label }),
    ogTitle: t("og-title"),
    ogSubtitle: t("og-subtitle", { region: label }),
    // Static (ISR) page: canonical must be explicit, since generateCanonical()
    // reads headers() which isn't available during static generation.
    canonical: ROUTES.CLANS(region),
  });
}


export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}) {
  const { locale, region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) redirect(localizePath(ROUTES.CLANS(Region.EU), locale));
  return <ClansLandingView region={region} language={null} locale={locale} />;
}

