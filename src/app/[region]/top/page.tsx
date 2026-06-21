import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TopLeaderboardsView } from "@/components/top/top-leaderboards-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { isRegion, Region, REGION_LABEL } from "@/services/wargaming/wot";

export function generateStaticParams() {
  // EU lives at /top (app/top/page.tsx + a redirect from /eu/top), so only
  // NA and ASIA are enumerated here. Exposing the params also lets the
  // sitemap auto-discovery pick the routes up at build time.
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
    title: `World of Tanks leaderboards (${label})`,
    description: `Top World of Tanks ${label} players over 24h, 7 days and all time, plus top clans, ranked by WNX, WN8 and WN7. ${APP.NAME} leaderboards.`,
    ogTitle: "Leaderboards",
    ogSubtitle: `${label} top players & clans`,
    canonical: ROUTES.TOP(region),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) redirect(ROUTES.TOP(Region.EU));
  return <TopLeaderboardsView region={region} />;
}

export const dynamic = "force-static";
export const revalidate = 3600;
