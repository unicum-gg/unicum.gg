import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlayersLandingView } from "@/components/players/players-landing-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  if (!isRegion(region)) return {};
  const label = REGION_LABEL[region];
  return constructMetadata({
    title: `Top World of Tanks players (${label})`,
    description: `${APP.NAME} ${label} player leaderboard, ranked by WNX, filterable by inferred clan-history language.`,
    ogTitle: "Top players",
    ogSubtitle: `${label} leaderboard`,
  });
}

export function generateStaticParams() {
  // EU lives at /players (handled by app/players/page.tsx + a redirect
  // from /eu/players), so only NA and ASIA are enumerated. Exposing the
  // params also lets next-sitemap pick the routes up at build time.
  return [{ region: Region.NA }, { region: Region.ASIA }];
}

export default async function Page({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) redirect(ROUTES.PLAYERS(Region.EU));
  return <PlayersLandingView region={region} language={null} />;
}

export const revalidate = 600;
