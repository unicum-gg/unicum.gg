import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TankCommunityView } from "@/components/tanks/list/community/view";
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
    title: `World of Tanks community tank ratings (${label}), best and most overrated tanks`,
    description: `${APP.NAME} ${label} community ratings: every World of Tanks vehicle scored out of five by the players who actually own it, with the gap between what the community thinks of a tank and what its win rate says. Only accounts with real battles on a tank can rate it.`,
    canonical: ROUTES.TANKS_COMMUNITY(region),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) redirect(ROUTES.TANKS_COMMUNITY(Region.EU));
  return <TankCommunityView region={region} />;
}
