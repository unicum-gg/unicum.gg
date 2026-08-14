import type { Metadata } from "next";
import { SteelHunterView } from "@/components/players/list/steel-hunter/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";

// ISR, like the WNX landing: prerendered HTML revalidated in the background so
// navigation stays instant while the board follows the cron's cadence.
export const dynamic = "force-static";
export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    title: `Top World of Tanks Steel Hunter battle royale players (${label})`,
    description: `${APP.NAME} ${label} leaderboard for Steel Hunter, World of Tanks' battle royale mode, ranked by our HR rating (average XP + win rate).`,
    ogTitle: "Top Steel Hunter players",
    ogSubtitle: `${label} battle royale leaderboard`,
    canonical: ROUTES.PLAYERS_STEEL_HUNTER(Region.EU),
  });
}

export default async function Page() {
  return <SteelHunterView region={Region.EU} />;
}
