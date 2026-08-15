import type { Metadata } from "next";
import { OnslaughtView } from "@/components/players/list/onslaught/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";

// Force-dynamic because the season selector reads `?season=`; the per-request
// cost is a DB read (a couple of cheap indexed queries), the default (current
// season) being the common path.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    title: `Top World of Tanks Onslaught players (${label})`,
    description: `${APP.NAME} ${label} leaderboard for Onslaught, World of Tanks' competitive 7v7 ranked mode, in the game's own standings order.`,
    ogTitle: "Top Onslaught players",
    ogSubtitle: `${label} ranked leaderboard`,
    canonical: ROUTES.PLAYERS_ONSLAUGHT(Region.EU),
  });
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const { season } = await searchParams;
  return <OnslaughtView region={Region.EU} season={season} />;
}
