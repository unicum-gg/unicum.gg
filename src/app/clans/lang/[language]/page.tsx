import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClansLandingView } from "@/components/clans/clans-landing-view";
import APP from "@/constants/app";
import { constructMetadata } from "@/lib/metadata";
import { getLanguageStats } from "@/services/clans/available-languages";
import { Region, REGION_LABEL } from "@/services/wargaming/wot";

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function languageDisplayName(code: string): string {
  return LANGUAGE_NAMES.of(code) ?? code.toUpperCase();
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ language: string }>;
  searchParams: Promise<{ strict?: string }>;
}): Promise<Metadata> {
  const [{ language }, { strict }] = await Promise.all([params, searchParams]);
  const name = languageDisplayName(language);
  const label = REGION_LABEL[Region.EU];
  const isStrict = strict === "1";
  return constructMetadata({
    title: isStrict
      ? `Strictly ${name} World of Tanks clans (${label})`
      : `Top ${name} World of Tanks clans (${label})`,
    description: isStrict
      ? `${APP.NAME} ${label} clan leaderboard for clans that declared ${name} as their only language, ranked by WNX.`
      : `${APP.NAME} ${label} clan leaderboard for clans that declared ${name} as one of their languages, ranked by WNX.`,
    ogTitle: isStrict ? `Strictly ${name} clans` : `Top ${name} clans`,
    ogSubtitle: `${label} leaderboard`,
  });
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ language: string }>;
  searchParams: Promise<{ strict?: string }>;
}) {
  const [{ language }, { strict }] = await Promise.all([params, searchParams]);
  const available = await getLanguageStats(Region.EU);
  if (!available.some((l) => l.code === language)) notFound();
  return (
    <ClansLandingView
      region={Region.EU}
      language={language}
      strict={strict === "1"}
    />
  );
}

export const revalidate = 600;
