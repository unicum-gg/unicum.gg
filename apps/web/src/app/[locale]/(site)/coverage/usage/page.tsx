import type { Metadata } from "next";
import { SiteUsageView } from "@/components/usage/site-usage-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { Region } from "@unicum.gg/wargaming";
import { withDictionaries } from "@/components/dictionaries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await getTranslation("app/coverage/usage/page", locale);
  return constructMetadata({
    locale,
    title: t("title"),
    description: t("description", { name: APP.NAME }),
    ogTitle: t("og-title"),
    ogSubtitle: t("og-subtitle"),
    canonical: ROUTES.COVERAGE_USAGE(Region.EU),
  });
}

async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <SiteUsageView region={Region.EU} locale={locale} />;
}

// ISR like the data tab beside it, on a shorter window: these are a few small
// indexed reads rather than full scans, and a reader checking how many people
// came today expects today.
export const dynamic = "force-static";
export const revalidate = 600;

export default withDictionaries("[locale]/(site)/coverage/usage", Page);
