import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClansLandingView } from "@/components/clans/clans-landing-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getLanguageStats } from "@/services/clans/available-languages";
import { isRegion, Region, REGION_LABEL } from "@unicum.gg/wargaming/region";

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

export async function generateStaticParams() {
  // Prerender only languages with a real strict cohort (≥25). Niche
  // languages fall through to on-demand rendering and ISR.
  const params: Array<{ region: string; language: string }> = [];
  for (const region of [Region.NA, Region.ASIA]) {
    const stats = await getLanguageStats(region);
    for (const stat of stats) {
      if (stat.strict < 25) continue;
      params.push({ region, language: stat.code });
    }
  }
  return params;
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

export const dynamic = "force-static";
export const revalidate = 600;
