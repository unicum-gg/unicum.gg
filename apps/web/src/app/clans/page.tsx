import type { Metadata } from "next";
import { ClansLandingView } from "@/components/clans/clans-landing-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";

export async function generateMetadata(): Promise<Metadata> {
  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    title: `Top World of Tanks clans (${label})`,
    description: `${APP.NAME} ${label} clan leaderboard, ranked by WNX, filterable by declared clan language.`,
    ogTitle: "Top clans",
    ogSubtitle: `${label} leaderboard`,
    canonical: ROUTES.CLANS(Region.EU),
  });
}

export default async function Page() {
  return (
    <ClansLandingView region={Region.EU} language={null} />
  );
}

export const dynamic = "force-static";
export const revalidate = 600;
