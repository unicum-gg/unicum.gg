import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TankChangesView } from "@/components/tanks/list/changes/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";

// ISR like the other tank landings: prerendered, revalidated in the background.
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
    title: `World of Tanks changes (${label}), tank buffs and nerfs by update`,
    description: `${APP.NAME} ${label} feed of every tank characteristic change in World of Tanks: the firepower, mobility, survivability and concealment buffs and nerfs Wargaming ships, update by update, straight from the game client.`,
    canonical: ROUTES.TANKS_CHANGES(region),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) redirect(ROUTES.TANKS_CHANGES(Region.EU));
  return <TankChangesView region={region} />;
}
