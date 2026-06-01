import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CoverageView } from "@/components/coverage/coverage-view";
import { isRegion, Region, REGION_LABEL } from "@/services/wargaming/wot";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  if (!isRegion(region)) return {};
  const label = REGION_LABEL[region];
  return {
    title: `Coverage (${label}), what we track, unicum.gg`,
    description: `Live coverage stats for ${label} on unicum.gg: players and clans tracked, snapshot counts, cron activity and refresh health.`,
  };
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
