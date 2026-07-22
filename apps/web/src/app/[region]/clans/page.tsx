import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClansLandingView } from "@/components/clans/list/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";


// ISR: served as prerendered HTML and revalidated in the background, so
// navigation stays instant while the data follows the endpoints' cadence.
// The SDK calls fail-soft to an empty shell at build time (a build must not
// depend on a running API); the first revalidation after deploy fills it in.
export const dynamic = "force-static";
export const revalidate = 600;

export function generateStaticParams() {
  // EU lives at /clans (handled by app/clans/page.tsx + a redirect from
  // /eu/clans), so only NA and ASIA are enumerated here. Exposing the
  // params also lets next-sitemap pick the routes up at build time.
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
    title: `Top World of Tanks clans (${label})`,
    description: `${APP.NAME} ${label} clan leaderboard, ranked by WNX, filterable by declared clan language.`,
    ogTitle: "Top clans",
    ogSubtitle: `${label} leaderboard`,
  });
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

