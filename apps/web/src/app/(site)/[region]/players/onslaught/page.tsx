import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OnslaughtView } from "@/components/players/list/onslaught/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";

// Force-dynamic because the season selector reads `?season=` (caching stays in
// the endpoint). The default (current season) is the common path.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  if (!isRegion(region)) return {};
  const label = REGION_LABEL[region];
  return constructMetadata({
    title: `Top World of Tanks Onslaught players (${label})`,
    description: `${APP.NAME} ${label} leaderboard for Onslaught, World of Tanks' competitive 7v7 ranked mode, in the game's own standings order.`,
    ogTitle: "Top Onslaught players",
    ogSubtitle: `${label} ranked leaderboard`,
    canonical: ROUTES.PLAYERS_ONSLAUGHT(region),
  });
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ region: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) redirect(ROUTES.PLAYERS_ONSLAUGHT(Region.EU));
  const { season } = await searchParams;
  return <OnslaughtView region={region} season={season} />;
}
