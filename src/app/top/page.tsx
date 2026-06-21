import type { Metadata } from "next";
import { TopLeaderboardsView } from "@/components/top/top-leaderboards-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { Region, REGION_LABEL } from "@/services/wargaming/wot";

export async function generateMetadata(): Promise<Metadata> {
  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    title: `World of Tanks leaderboards (${label})`,
    description: `Top World of Tanks ${label} players over 24h, 7 days and all time, plus top clans, ranked by WNX, WN8 and WN7. ${APP.NAME} leaderboards.`,
    ogTitle: "Leaderboards",
    ogSubtitle: `${label} top players & clans`,
    canonical: ROUTES.TOP(Region.EU),
  });
}

export default function Page() {
  return <TopLeaderboardsView region={Region.EU} />;
}

export const dynamic = "force-static";
export const revalidate = 3600;
