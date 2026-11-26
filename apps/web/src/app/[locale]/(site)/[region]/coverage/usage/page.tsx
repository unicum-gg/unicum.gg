import type { Metadata } from "next";
import { localizePath } from "@/lib/translations";
import { notFound, redirect } from "next/navigation";
import { SiteUsageView } from "@/components/usage/site-usage-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { isRegion, Region } from "@unicum.gg/wargaming";
import { withDictionaries } from "@/components/dictionaries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}): Promise<Metadata> {
  const { locale, region } = await params;
  if (!isRegion(region)) return {};
  const { t } = await getTranslation("app/coverage/usage/page", locale);
  // The figures are the same on every server, so every server's copy of the
  // tab names the region-less one as canonical. The page exists per region
  // only so the tab bar keeps the reader on the server they came from.
  return constructMetadata({
    locale,
    title: t("title"),
    description: t("description", { name: APP.NAME }),
    ogTitle: t("og-title"),
    ogSubtitle: t("og-subtitle"),
    canonical: ROUTES.COVERAGE_USAGE(Region.EU),
  });
}

async function UsagePage({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}) {
  const { locale, region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) {
    redirect(localizePath(ROUTES.COVERAGE_USAGE(Region.EU), locale));
  }
  return <SiteUsageView region={region} locale={locale} />;
}

export const dynamic = "force-static";
export const revalidate = 600;

export async function generateStaticParams() {
  return [Region.NA, Region.ASIA].map((region) => ({ region }));
}

export default withDictionaries("[locale]/(site)/[region]/coverage/usage", UsagePage);
