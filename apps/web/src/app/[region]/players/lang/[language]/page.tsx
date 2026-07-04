import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlayersLandingView } from "@/components/players/players-landing-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getPlayerLanguageStats } from "@/services/players/available-languages";
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
    title: `Top ${name} World of Tanks players (${label})`,
    description: `${APP.NAME} ${label} player leaderboard for players whose inferred clan-history language set includes ${name}, ranked by WNX.`,
    ogTitle: `Top ${name} players`,
    ogSubtitle: `${label} leaderboard`,
    canonical: ROUTES.PLAYERS_BY_LANGUAGE(region, language),
  });
}

export async function generateStaticParams() {
  // Prerender common languages only (≥100 eligible players). Niche
  // languages fall through to on-demand rendering and ISR.
  const params: Array<{ region: string; language: string }> = [];
  for (const region of [Region.NA, Region.ASIA]) {
    const stats = await getPlayerLanguageStats(region);
    for (const stat of stats) {
      if (stat.total < 100) continue;
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
    redirect(ROUTES.PLAYERS_BY_LANGUAGE(Region.EU, language));
  }
  return (
    <PlayersLandingView region={region} language={language} strict={false} />
  );
}

export const dynamic = "force-static";
export const revalidate = 600;
