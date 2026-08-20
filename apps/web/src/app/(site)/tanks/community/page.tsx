import type { Metadata } from "next";
import { TankCommunityView } from "@/components/tanks/list/community/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";

// EU shortcut: /tanks/community renders the same board as /eu/tanks/community.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

export async function generateMetadata(): Promise<Metadata> {
  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    title: `World of Tanks community tank ratings (${label}), best and most overrated tanks`,
    description: `${APP.NAME} ${label} community ratings: every World of Tanks vehicle scored out of five by the players who actually own it, with the gap between what the community thinks of a tank and what its win rate says. Only accounts with real battles on a tank can rate it.`,
    canonical: ROUTES.TANKS_COMMUNITY(Region.EU),
  });
}

export default async function TankCommunityPageEU() {
  return <TankCommunityView region={Region.EU} />;
}
