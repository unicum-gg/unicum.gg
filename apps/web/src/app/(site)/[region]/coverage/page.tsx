import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CoverageView } from "@/components/coverage/coverage-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  if (!isRegion(region)) return {};
  const label = REGION_LABEL[region];
  return constructMetadata({
    title: `World of Tanks data coverage (${label})`,
    description: `How many World of Tanks players and clans ${APP.NAME} tracks on ${label}, snapshot refresh rate, data depth, infrastructure cost and uptime.`,
    ogTitle: "Data coverage",
    ogSubtitle: `${label} players & clans`,
    canonical: ROUTES.COVERAGE(region),
  });
}


export default async function CoveragePage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) redirect(ROUTES.COVERAGE(Region.EU));
  return <CoverageView region={region} />;
}

// ISR: prerendered and revalidated in the background, so the (expensive)
// coverage computation never blocks a visitor. The SDK loopback handles the
// build-time fetch, so a build no longer depends on a running API. The window
// matches the coverage stats' own 60s cache (live-monitoring figures must stay
// fresh) rather than relying on that cache to implicitly lower the segment.
export const dynamic = "force-static";
export const revalidate = 60;

export async function generateStaticParams() {
  return [Region.NA, Region.ASIA].map((region) => ({ region }));
}
