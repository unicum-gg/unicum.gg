import type { Metadata } from "next";
import { localizePath } from "@/lib/translations";
import { notFound, redirect } from "next/navigation";
import { CoverageView } from "@/components/coverage/coverage-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}): Promise<Metadata> {
  const { locale, region } = await params;
  if (!isRegion(region)) return {};
  const label = REGION_LABEL[region];
  const { t } = await getTranslation("app/coverage/page", locale);
  return constructMetadata({
    locale,
    title: t("title", { region: label }),
    description: t("description", { name: APP.NAME, region: label }),
    ogTitle: t("og-title"),
    ogSubtitle: t("og-subtitle", { region: label }),
    canonical: ROUTES.COVERAGE(region),
  });
}


export default async function CoveragePage({
  params,
}: {
  params: Promise<{ locale: string; region: string }>;
}) {
  const { locale, region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) redirect(localizePath(ROUTES.COVERAGE(Region.EU), locale));
  return <CoverageView region={region} locale={locale} />;
}

// ISR: prerendered and revalidated in the background, so the (expensive)
// coverage computation never blocks a visitor. The SDK loopback handles the
// build-time fetch, so a build no longer depends on a running API. The window
// matches the coverage stats' own 60s cache (live-monitoring figures must stay
// fresh) rather than relying on that cache to implicitly lower the segment.
export const dynamic = "force-static";
// 1h, not 60s. This page's queries are full seq-scans of the 10M+ row snapshot
// table (~24s each). At revalidate=60 every minute paid that scan, and a cold
// cache (post-deploy) let the PM2 cluster regenerate it concurrently, storming
// the DB into a spiral that starved every other endpoint. The coverage figures
// move on a daily cadence, so a 60s window bought nothing; 1h keeps the scan
// rare. (The real fix is to precompute these via a cron like the materialized
// leaderboards, rather than scan on the request path.)
export const revalidate = 3600;

export async function generateStaticParams() {
  return [Region.NA, Region.ASIA].map((region) => ({ region }));
}
