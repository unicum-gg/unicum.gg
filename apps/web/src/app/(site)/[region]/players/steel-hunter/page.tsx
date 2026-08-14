import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SteelHunterView } from "@/components/players/list/steel-hunter/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";

export const dynamic = "force-static";
export const revalidate = 1800;

export function generateStaticParams() {
  // EU lives at /players/steel-hunter; only NA and ASIA are enumerated here.
  return [{ region: Region.NA }, { region: Region.ASIA }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  if (!isRegion(region)) return {};
  const label = REGION_LABEL[region];
  return constructMetadata({
    title: `Top World of Tanks Steel Hunter battle royale players (${label})`,
    description: `${APP.NAME} ${label} leaderboard for Steel Hunter, World of Tanks' battle royale mode, ranked by our HR rating (average XP + win rate).`,
    ogTitle: "Top Steel Hunter players",
    ogSubtitle: `${label} battle royale leaderboard`,
    canonical: ROUTES.PLAYERS_STEEL_HUNTER(region),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) redirect(ROUTES.PLAYERS_STEEL_HUNTER(Region.EU));
  return <SteelHunterView region={region} />;
}
