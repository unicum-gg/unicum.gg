import type { Metadata } from "next";
import { PlayersLandingView } from "@/components/players/players-landing-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming/region";

export async function generateMetadata(): Promise<Metadata> {
  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    title: `Top World of Tanks players (${label})`,
    description: `${APP.NAME} ${label} player leaderboard, ranked by WNX, filterable by inferred clan-history language.`,
    ogTitle: "Top players",
    ogSubtitle: `${label} leaderboard`,
    canonical: ROUTES.PLAYERS(Region.EU),
  });
}

export default async function Page() {
  return <PlayersLandingView region={Region.EU} language={null} />;
}

export const dynamic = "force-static";
export const revalidate = 600;
