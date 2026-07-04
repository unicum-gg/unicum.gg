import type { Metadata } from "next";
import { ClansLandingView } from "@/components/clans/clans-landing-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getLanguageStats } from "@/services/clans/available-languages";
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
    title: `Strictly ${name} World of Tanks clans (${label})`,
    description: `${APP.NAME} ${label} clan leaderboard for clans that declared ${name} as their only language, ranked by WNX.`,
    ogTitle: `Strictly ${name} clans`,
    ogSubtitle: `${label} leaderboard`,
    canonical: ROUTES.CLANS_BY_LANGUAGE(Region.EU, language, true),
  });
}

export async function generateStaticParams() {
  // Strict variant: prerender only languages with a real strict cohort
  // (≥25 strict-only clans). Niche languages fall through to on-demand
  // rendering and ISR.
  const stats = await getLanguageStats(Region.EU);
  return stats.filter((s) => s.strict >= 25).map((s) => ({ language: s.code }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ language: string }>;
}) {
  const { language } = await params;
  return (
    <ClansLandingView region={Region.EU} language={language} strict={true} />
  );
}

export const dynamic = "force-static";
export const revalidate = 600;
