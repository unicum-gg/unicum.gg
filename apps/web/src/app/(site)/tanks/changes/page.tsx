import type { Metadata } from "next";
import { TankChangesView } from "@/components/tanks/list/changes/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";

// EU shortcut: /tanks/changes renders the same feed as /eu/tanks/changes.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

export async function generateMetadata(): Promise<Metadata> {
  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    title: `World of Tanks changes (${label}), tank buffs and nerfs by update`,
    description: `${APP.NAME} ${label} feed of every tank characteristic change in World of Tanks: the firepower, mobility, survivability and concealment buffs and nerfs Wargaming ships, update by update, straight from the game client.`,
    canonical: ROUTES.TANKS_CHANGES(Region.EU),
  });
}

export default async function TankChangesPageEU() {
  return <TankChangesView region={Region.EU} />;
}
