import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClansLandingView } from "@/components/clans/clans-landing-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { isRegion, Region, REGION_LABEL } from "@/services/wargaming/wot";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  if (!isRegion(region)) return {};
  const label = REGION_LABEL[region];
  return constructMetadata({
    title: `Top World of Tanks clans (${label})`,
    description: `${APP.NAME} ${label} clan leaderboard, ranked by WNX, filterable by declared clan language.`,
    ogTitle: "Top clans",
    ogSubtitle: `${label} leaderboard`,
  });
}

export function generateStaticParams() {
  // EU lives at /clans (handled by app/clans/page.tsx + a redirect from
  // /eu/clans), so only NA and ASIA are enumerated here. Exposing the
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
  if (region === Region.EU) redirect(ROUTES.CLANS(Region.EU));
  return <ClansLandingView region={region} language={null} />;
}

export const revalidate = 600;
