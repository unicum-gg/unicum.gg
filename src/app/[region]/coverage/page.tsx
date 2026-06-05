import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CoverageView } from "@/components/coverage/coverage-view";
import APP from "@/constants/app";
import { constructMetadata } from "@/lib/metadata";
import { isRegion, Region, REGION_LABEL } from "@/services/wargaming/wot";

// Caching is owned by `getCoverageStats` via `'use cache' + cacheLife()` —
// page-level revalidate would be redundant and conflict with the cache scope.

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
  });
}

export default async function CoveragePage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) redirect("/coverage");
  return <CoverageView region={region} />;
}
