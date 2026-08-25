import type { Metadata } from "next";
import { MapChangesView } from "@/components/maps/list/changes/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming";

// EU shortcut: /maps/changes renders the same feed as /eu/maps/changes.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

export async function generateMetadata(): Promise<Metadata> {
  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    title: `World of Tanks map changes (${label}), reworks by update`,
    description: `${APP.NAME} ${label} feed of every World of Tanks map change: play areas resized, bases and spawns moved, game modes gained and lost, maps added and removed, update by update, straight from the game client.`,
    canonical: ROUTES.MAPS_CHANGES(Region.EU),
  });
}

export default async function MapChangesPageEU() {
  return <MapChangesView region={Region.EU} />;
}
