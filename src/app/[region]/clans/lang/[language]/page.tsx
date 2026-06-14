import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClansLandingView } from "@/components/clans/clans-landing-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getAvailableLanguages } from "@/services/clans/available-languages";
import { isRegion, Region, REGION_LABEL } from "@/services/wargaming/wot";

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
    title: `Top ${name} World of Tanks clans (${label})`,
    description: `${APP.NAME} ${label} clan leaderboard for clans that declared ${name} as one of their languages, ranked by WNX.`,
    ogTitle: `Top ${name} clans`,
    ogSubtitle: `${label} leaderboard`,
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
    redirect(ROUTES.CLANS_BY_LANGUAGE(Region.EU, language));
  }
  const available = await getAvailableLanguages(region);
  if (!available.some((l) => l.code === language)) notFound();
  return <ClansLandingView region={region} language={language} />;
}

export const revalidate = 600;
