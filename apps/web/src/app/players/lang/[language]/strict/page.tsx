import type { Metadata } from "next";
import { PlayersLandingView } from "@/components/players/players-landing-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getPlayerLanguageStats } from "@/services/players/available-languages";
import { Region, REGION_LABEL } from "@unicum.gg/wargaming/region";

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function languageDisplayName(code: string): string {
  return LANGUAGE_NAMES.of(code) ?? code.toUpperCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ language: string }>;
}): Promise<Metadata> {
  const { language } = await params;
  const name = languageDisplayName(language);
  const label = REGION_LABEL[Region.EU];
  return constructMetadata({
    title: `Strictly ${name} World of Tanks players (${label})`,
    description: `${APP.NAME} ${label} player leaderboard for players whose inferred clan-history language is exclusively ${name}, ranked by WNX.`,
    ogTitle: `Strictly ${name} players`,
    ogSubtitle: `${label} leaderboard`,
    canonical: ROUTES.PLAYERS_BY_LANGUAGE(Region.EU, language, true),
  });
}

export async function generateStaticParams() {
  // Strict variant: prerender only languages with a real strict cohort
  // (≥25 strict-only players). Niche languages fall through to on-demand
  // rendering and ISR.
  const stats = await getPlayerLanguageStats(Region.EU);
  return stats.filter((s) => s.strict >= 25).map((s) => ({ language: s.code }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ language: string }>;
}) {
  const { language } = await params;
  return (
    <PlayersLandingView region={Region.EU} language={language} strict={true} />
  );
}

export const dynamic = "force-static";
export const revalidate = 600;
