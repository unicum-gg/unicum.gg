import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClansLandingView } from "@/components/clans/clans-landing-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming";

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function languageDisplayName(code: string): string {
  return LANGUAGE_NAMES.of(code) ?? code.toUpperCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; language: string }>;
}): Promise<Metadata> {
  const { region, language } = await params;
  if (!isRegion(region)) return {};
  const name = languageDisplayName(language);
  const label = REGION_LABEL[region];
  return constructMetadata({
    title: `Strictly ${name} World of Tanks clans (${label})`,
    description: `${APP.NAME} ${label} clan leaderboard for clans that declared ${name} as their only language, ranked by WNX.`,
    ogTitle: `Strictly ${name} clans`,
    ogSubtitle: `${label} leaderboard`,
    canonical: ROUTES.CLANS_BY_LANGUAGE(region, language, true),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ region: string; language: string }>;
}) {
  const { region, language } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) {
    redirect(ROUTES.CLANS_BY_LANGUAGE(Region.EU, language, true));
  }
  return <ClansLandingView region={region} language={language} strict={true} />;
}

// Dynamic on purpose: the page consumes our own API through the SDK, and
// prerendering it at build time would make the build depend on a running API.
// The endpoints cache server-side, so per-request cost is local HTTP hops onto
// cached payloads.
export const dynamic = "force-dynamic";
