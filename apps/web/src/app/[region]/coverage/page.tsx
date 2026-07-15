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

// Dynamic on purpose: the page consumes our own /coverage API through the SDK
// (fetching at build time would make the build depend on a running API). The
// endpoint itself caches for 60s server-side, so per-request cost is one local
// HTTP hop onto a cached payload.
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return [Region.NA, Region.ASIA].map((region) => ({ region }));
}
