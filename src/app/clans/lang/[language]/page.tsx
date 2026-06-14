import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClansLandingView } from "@/components/clans/clans-landing-view";
import APP from "@/constants/app";
import { constructMetadata } from "@/lib/metadata";
import { getAvailableLanguages } from "@/services/clans/available-languages";
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
    title: `Top ${name} World of Tanks clans (${label})`,
    description: `${APP.NAME} ${label} clan leaderboard for clans that declared ${name} as one of their languages, ranked by WNX.`,
    ogTitle: `Top ${name} clans`,
    ogSubtitle: `${label} leaderboard`,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ language: string }>;
}) {
  const { language } = await params;
  const available = await getAvailableLanguages(Region.EU);
  if (!available.some((l) => l.code === language)) notFound();
  return (
    <ClansLandingView region={Region.EU} language={language} />
  );
}

export const revalidate = 600;
