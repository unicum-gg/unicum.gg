import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MapChangesView } from "@/components/maps/list/changes/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";

// ISR like the other map landings: prerendered, revalidated in the background.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  if (!isRegion(region)) return {};
  const label = REGION_LABEL[region];
  return constructMetadata({
    title: `World of Tanks map changes (${label}), reworks by update`,
    description: `${APP.NAME} ${label} feed of every World of Tanks map change: play areas resized, bases and spawns moved, game modes gained and lost, maps added and removed, update by update, straight from the game client.`,
    canonical: ROUTES.MAPS_CHANGES(region),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) redirect(ROUTES.MAPS_CHANGES(Region.EU));
  return <MapChangesView region={region} />;
}
