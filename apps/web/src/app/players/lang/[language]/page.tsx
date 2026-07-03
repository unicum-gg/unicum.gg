import type { Metadata } from "next";
import { PlayersLandingView } from "@/components/players/players-landing-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getPlayerLanguageStats } from "@/services/players/available-languages";
import { Region, REGION_LABEL } from "@/services/wargaming/wot";

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
    title: `Top ${name} World of Tanks players (${label})`,
    description: `${APP.NAME} ${label} player leaderboard for players whose inferred clan-history language set includes ${name}, ranked by WNX.`,
    ogTitle: `Top ${name} players`,
    ogSubtitle: `${label} leaderboard`,
    canonical: ROUTES.PLAYERS_BY_LANGUAGE(Region.EU, language),
  });
}

export async function generateStaticParams() {
  // Prerender common languages only (≥100 eligible players). Niche
  // languages fall through to on-demand rendering and ISR.
  const stats = await getPlayerLanguageStats(Region.EU);
  return stats.filter((s) => s.total >= 100).map((s) => ({ language: s.code }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ language: string }>;
}) {
  const { language } = await params;
  return (
    <PlayersLandingView region={Region.EU} language={language} strict={false} />
  );
}

export const dynamic = "force-static";
export const revalidate = 600;
