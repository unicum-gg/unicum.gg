import type { Metadata } from "next";
import { OnslaughtView } from "@/components/players/list/onslaught/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";

// ISR like the other leaderboards: the page renders the current season and is
// cached, so it is a cheap read instead of re-rendering the whole ~4k-row board
// on every request. The season selector's `?season=` is read client-side (see
// OnslaughtBoardLive), so it no longer opts the page into dynamic rendering.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min, matches the other boards

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

export default function Page() {
  return <OnslaughtView region={Region.EU} />;
}
