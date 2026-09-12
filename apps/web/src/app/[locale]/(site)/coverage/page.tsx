import type { Metadata } from "next";
import { CoverageView } from "@/components/coverage/coverage-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await getTranslation("app/coverage/page", locale);

  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    locale,
    title: t("title", { region: label }),
    description: t("description", { name: APP.NAME, region: label }),
    ogTitle: t("og-title"),
    ogSubtitle: t("og-subtitle", { region: label }),
    canonical: ROUTES.COVERAGE(Region.EU),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <CoverageView region={Region.EU} locale={locale} />;
}

// ISR: prerendered and revalidated in the background, so the (expensive)
// coverage computation never blocks a visitor. The SDK loopback handles the
// build-time fetch, so a build no longer depends on a running API. The window
// matches the coverage stats' own 60s cache (live-monitoring figures must stay
// fresh) rather than relying on that cache to implicitly lower the segment.
export const dynamic = "force-static";
// 1h, not 60s: the queries are ~24s full seq-scans of the 10M+ row snapshot
// table, so a 60s window paid that scan every minute (and stormed the DB from a
// cold cache). Coverage figures move daily; see the region page for the detail.
export const revalidate = 3600;
