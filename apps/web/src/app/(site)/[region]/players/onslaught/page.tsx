import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OnslaughtView } from "@/components/players/list/onslaught/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";

// ISR like the other leaderboards: renders the current season, cached. The
// season selector's `?season=` is read client-side (OnslaughtBoardLive), so it
// no longer forces per-request rendering of the whole ~4k-row board.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min, matches the other boards

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
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) redirect(ROUTES.PLAYERS_ONSLAUGHT(Region.EU));
  return <OnslaughtView region={region} />;
}
